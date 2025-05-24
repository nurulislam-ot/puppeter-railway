import puppeteer from "puppeteer-extra"
import { ElementHandle } from "puppeteer"
import { TZDate } from "@date-fns/tz"
import {
  ACTIVE_USER_SELECTOR,
  BOOK_NOW_BUTTON_SELECTOR,
  DEPARTURE_DATE_TIME_SELECTOR,
  SEAT_AVAILABILITY_SELECTOR,
  SEAT_CLASS_CONTAINER_SELECTOR,
  SEAT_TYPE_SELECTOR,
  TRAIN_NAME_SELECTOR,
} from "./constant/selector"

const config = {
  phone: process.env.USER_LOGIN_PHONE_NUMBER ?? "",
  password: process.env.USER_LOGIN_PASSWORD ?? "",
}

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
  PREFER_TRAIN_NAME: string
  URL: string
  SEAT_COUNT: number
  PREFER_TIME_RANGE?: [string, string]
}

const isThisHourInPreferTimeRange = (
  hour: Date,
  prefer_time_range: [string, string]
): boolean => {
  const [start, end] = prefer_time_range.map((time) => {
    const [h, m] = time.split(":").map(Number)
    return new TZDate(
      hour.getFullYear(),
      hour.getMonth(),
      hour.getDate(),
      h,
      m,
      "Asia/Dhaka"
    )
  })
  return hour >= start && hour <= end
}

const buy_ticket = async ({
  URL,
  SEAT_COUNT,
  PREFER_TIME_RANGE,
  PREFER_TRAIN_NAME,
}: BuyTicketParams) => {
  const trip_obj = {} as TripObjectI

  try {
    const browser = await puppeteer.launch({
      headless: false,
    })
    const page = await browser.newPage()

    await page.goto(URL, {
      waitUntil: "networkidle2",
    })

    const trips = await page.$$("app-single-trip")

    const trips_promises = trips.map(async (trip) => {
      const train_name = await trip.$eval(
        TRAIN_NAME_SELECTOR,
        (elem) => elem.innerText
      )
      const active_user = await trip.$eval(
        ACTIVE_USER_SELECTOR,
        (elem) => elem.innerText
      )
      const departure_date_time_string = await trip.$eval(
        DEPARTURE_DATE_TIME_SELECTOR,
        (element) => element.innerText
      )
      const departure_date_time = new TZDate(
        departure_date_time_string,
        "Asia/Dhaka"
      )

      if (PREFER_TIME_RANGE) {
        const condition = isThisHourInPreferTimeRange(
          departure_date_time,
          PREFER_TIME_RANGE
        )
        console.log(condition, departure_date_time)
      }

      const seat_class_container = await trip.$$(SEAT_CLASS_CONTAINER_SELECTOR)

      const seat_availability_obj: SeatAvailabilityI = {}
      const book_now_buttons: BookNowButtonsI = {}

      const seat_details_promises = seat_class_container.map(async (seat) => {
        const book_now_el = await seat.$(BOOK_NOW_BUTTON_SELECTOR)
        const seat_type = await seat.$eval(
          SEAT_TYPE_SELECTOR,
          (elem) => elem.innerText
        )

        // seat_availability = seat_avl
        const seat_availability = await seat.$eval(
          SEAT_AVAILABILITY_SELECTOR,
          (elem) => elem.innerText
        )

        seat_availability_obj[seat_type] = seat_availability
        book_now_buttons[seat_type] = book_now_el
      })

      await Promise.all(seat_details_promises)

      trip_obj[train_name] = {
        active_user,
        seat_availability: seat_availability_obj,
        book_now_buttons,
      }

      return train_name
    })

    await Promise.all(trips_promises)

    const S_CHAIR = trip_obj[PREFER_TRAIN_NAME].book_now_buttons.S_CHAIR
    if (!S_CHAIR) throw Error(`${PREFER_TRAIN_NAME} S_CHAIR not found!`)

    await S_CHAIR.click()

    const modal = await page.waitForSelector(".login-modal-form")
    if (modal) {
      const mobileInput = await modal.$("#mobile_number")
      if (!mobileInput) throw new Error("Mobile input not found")
      await mobileInput.type(config.phone)

      const passwordInput = await modal.$("#trainAppLoginPassword")
      if (!passwordInput) throw new Error("Password input not found")
      await passwordInput.type(config.password)

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

    // random seat selection
    if (free_seats.length <= SEAT_COUNT) throw Error("No free seats available")
    console.log(`Total Free Seats: ${free_seats.length}`)

    const random_seat_selected_index_array = new Set<{
      seat_index: number
      seat_number: string
    }>()
    while (random_seat_selected_index_array.size < SEAT_COUNT) {
      const random_index = Math.floor(Math.random() * free_seats.length)
      const seat_number = await free_seats[random_index].evaluate(
        (el) => el.innerText
      )
      random_seat_selected_index_array.add({
        seat_index: random_index,
        seat_number,
      })
    }

    console.log(random_seat_selected_index_array)

    return
    random_seat_selected_index_array.forEach(async (seat) => {
      await free_seats[seat.seat_index].click()
    })

    return
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
  PREFER_TRAIN_NAME: "DRUTOJAN EXPRESS (757)",
  URL: "https://eticket.railway.gov.bd/booking/train/search?fromcity=Dhaka&tocity=Santahar&doj=27-May-2025&class=S_CHAIR",
  SEAT_COUNT: 3,
  PREFER_TIME_RANGE: ["07:45", "12:30"],
})
