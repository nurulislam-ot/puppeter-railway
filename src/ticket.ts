import puppeteer from "puppeteer-extra"
import { ElementHandle } from "puppeteer"
puppeteer.use(
  require("puppeteer-extra-plugin-user-preferences")({
    userPrefs: {
      safebrowsing: {
        enabled: false,
        enhanced: false,
      },
    },
  })
)

function delay(time: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  })
}

interface SeatAvailabilityI {
  [seat_class: string]: string
}

interface BookNowButtonsI {
  [seat_class: string]: ElementHandle<Element> | null
}

interface TripObjectI {
  [trip: string]: {
    active_user: string
    seat_availability: SeatAvailabilityI
    book_now_buttons: BookNowButtonsI
  }
}

interface BuyTicketParams {
  TRAIN_NAME: string
}

const buy_ticket = async ({ TRAIN_NAME }: BuyTicketParams) => {
  const trip_obj = {} as TripObjectI

  try {
    const browser = await puppeteer.launch({
      headless: false,
    })
    const page = await browser.newPage()

    await page.goto(
      "https://eticket.railway.gov.bd/booking/train/search?fromcity=Dhaka&tocity=Santahar&doj=10-Nov-2024&class=S_CHAIR",
      {
        waitUntil: "networkidle2",
      }
    )

    const trips = await page.$$("app-single-trip")

    await Promise.all(
      trips.map(async (trip) => {
        const train_name = await trip.$eval(
          ".trip-left-info h2",
          (elem) => elem.innerText
        )
        const active_user = await trip.$eval(
          ".trip-left-info .active-trip-users p span",
          (elem) => elem.innerText
        )

        const seat_class_container = await trip.$$(".single-seat-class")

        const seat_availability_obj: SeatAvailabilityI = {}
        const book_now_buttons: BookNowButtonsI = {}

        await Promise.all(
          seat_class_container.map(async (seat) => {
            const book_now_el = await seat.$(".book-now-btn")
            const seat_type = await seat.$eval(
              "span.seat-class-name",
              (elem) => elem.innerText
            )

            // seat_availability = seat_avl
            const seat_availability = await seat.$eval(
              "span.all-seats",
              (elem) => elem.innerText
            )

            seat_availability_obj[seat_type] = seat_availability
            book_now_buttons[seat_type] = book_now_el
          })
        )

        trip_obj[train_name] = {
          active_user,
          seat_availability: seat_availability_obj,
          book_now_buttons,
        }

        return train_name
      })
    )

    const S_CHAIR = trip_obj[TRAIN_NAME].book_now_buttons.S_CHAIR
    if (!S_CHAIR) throw Error(`${TRAIN_NAME} S_CHAIR not found!`)

    await S_CHAIR.click()

    const modal = await page.waitForSelector(".login-modal-form")
    if (modal) {
      const mobileInput = await modal.$("#mobile_number")
      if (!mobileInput) throw new Error("Mobile input not found")
      await mobileInput.type("01722266531")

      const passwordInput = await modal.$("#trainAppLoginPassword")
      if (!passwordInput) throw new Error("Password input not found")
      await passwordInput.type("Dx6ZNi29@LCjf5M")

      const loginButton = await modal.$('[type="submit"]')
      if (loginButton) await loginButton.click()
    }
    await delay(1000)

    await S_CHAIR.click()

    // select bogie
    const bogie_select_el = await page.waitForSelector("select#select-bogie", {
      timeout: 10000,
    })
    if (!bogie_select_el) throw Error("Bogie Select Element Not Found")

    const selected_bogie_value = await bogie_select_el.$$eval(
      "option",
      (bogies) =>
        bogies.find((bogie) => +bogie.innerText.split(" ")[2] > 0)?.value
    )

    if (!selected_bogie_value) throw Error("bogie value not find")
    await page.select("select#select-bogie", selected_bogie_value)

    // now select seat
    const free_seats = await page.$$("button.seat-available")
    await free_seats[0].click()
    await delay(1000)

    const continue_btn = await page.waitForSelector("button.continue-btn", {
      timeout: 10000,
    })

    if (!continue_btn) throw Error("Continue Purchase Button Element Not Found")
    await continue_btn.click()
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message)
    }
  }
}

buy_ticket({
  TRAIN_NAME: "NILSAGAR EXPRESS (765)",
})
