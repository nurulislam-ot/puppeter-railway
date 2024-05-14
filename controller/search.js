const puppeteer = require('puppeteer')
const cheerio = require('cheerio')

// convert text to number
const textToNumber = text => {
  return Number(text.replace(/\D/g, ''))
}

function isItPriorityTime(date_string, priority_time) {
  const date = new Date(date_string.replace(',', '')) // Remove comma for compatibility
  const hours = date.getHours()

  // Check if it's a peak time based on the specified time of day
  let isPeakTime = false
  if (priority_time === 'morning') {
    isPeakTime = hours >= 7 && hours < 12
  } else if (priority_time === 'evening') {
    isPeakTime = hours >= 13 && hours < 16
  } else if (priority_time === 'night') {
    isPeakTime = hours >= 17 || hours < 5
  }

  // Return true if it's a peak time based on the specified time of day
  return isPeakTime
}

// wait for certain seconds
const delay = async seconds => {
  return new Promise(resolve => {
    setTimeout(resolve, seconds * 1000)
  })
}

const controller = {
  search: async (req, res) => {
    try {
      // Launch the browser and open a new blank page
      const browser = await puppeteer.launch()
      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800 })

      page.on('request', request => {
        const url = request.url()
        if (url.match(/^(https:\/\/)(rails|eticket)/gm)) {
          console.log(url)
        }
      })

      const { from, to, date, class: seat_class, priority_time } = req.query

      // Navigate the page to a URL
      await page.goto(
        `https://eticket.railway.gov.bd/booking/train/search?fromcity=${from}&tocity=${to}&doj=${date}&class=${seat_class}`
      )

      await page.waitForResponse(
        response => {
          return response.url().match(/search-trips/) && response.ok()
        },
        { timeout: 2000 }
      )

      await page.screenshot({ path: 'before-login.png' })

      const $ = cheerio.load(await page.content())

      const trips = $('.single-trip-wrapper')

      if (trips.length === 0) {
        return res
          .json({ message: 'No trips found', length: trips.length })
          .status(404)
      }

      const response_trips = []
      trips.each((index, trip) => {
        const train = {}
        const arrival_time = $(trip).find('.journey-date').eq(0).text()
        if (
          priority_time ? isItPriorityTime(arrival_time, priority_time) : true
        ) {
          train.name = $(trip).find('h2').text()
          train.arrival = {
            time: arrival_time,
            station: $(trip).find('.journey-location').eq(0).text()
          }
          train.departure = {
            time: $(trip).find('.journey-date').eq(1).text(),
            station: $(trip).find('.journey-location').eq(1).text()
          }
          const seats = $(trip).find('.single-seat-class')

          train.availability = seats
            .map((index, seat) => {
              return {
                name: $(seat).find('.seat-class-name').text(),
                available: textToNumber($(seat).find('.all-seats').text()),
                fare: textToNumber($(seat).find('.seat-class-fare').text())
              }
            })
            .get()

          response_trips.push(train)
        }
      })

      if (response_trips.length === 0) {
        return res
          .json({ message: 'No trips found during peak time' })
          .status(404)
      }

      const book_now_button = await page.$('.book-now-btn')
      if (!book_now_button) throw new Error('Book now button not found')
      await book_now_button.click()

      const modal = await page.waitForSelector('.login-modal-form')
      if (modal) {
        const mobileInput = await modal.$('#mobile_number')
        if (!mobileInput) throw new Error('Mobile input not found')
        await mobileInput.type('01722266531')

        const passwordInput = await modal.$('#trainAppLoginPassword')
        if (!mobileInput) throw new Error('Password input not found')
        await passwordInput.type('Dx6ZNi29@LCjf5M')

        const loginButton = await modal.$('[type="submit"]')
        await loginButton.click()

        await page.waitForResponse(async response => {
          await delay(2)
          return response.url().match(/auth\/sign-in/) && response.ok()
        })
      }

      await page.screenshot({ path: 'after-login.png' })
      await book_now_button.click()

      await page.waitForResponse(response => {
        return response.url().match(/bookings\/seat-layout/)
      })

      await page.waitForSelector('.seat-layout-view')
      const seat_select = await page.$('.seat-layout-view')
      if (seat_select) {
        const bodgieSelect = await seat_select.$('#select-bogie')
        await bodgieSelect.select('1')
      }

      await browser.close()

      return res.json({ trips: response_trips })
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }
}

module.exports = controller
