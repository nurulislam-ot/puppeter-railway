import cron from "node-cron"
import puppeteer from "puppeteer-extra"
import { ElementHandle } from "puppeteer"

import {
  BOOK_NOW_BUTTON_SELECTOR,
  SEAT_CLASS_CONTAINER_SELECTOR,
  SEAT_TYPE_SELECTOR,
} from "./constant/selector"
import get_available_seat_buttons from "./get-available-seat-buttons"
import get_bogie from "./get-bogie"
import get_trips from "./get-trips"
import login from "./login"

const config = {
  phone: process.env.USER_LOGIN_PHONE_NUMBER ?? "",
  password: process.env.USER_LOGIN_PASSWORD ?? "",
}

cron.schedule(
  "45 50 0 * * *",
  async function () {
    const config = {
      PREFER_TRAIN_NAME: "DRUTOJAN EXPRESS (757)",
      URL: "https://eticket.railway.gov.bd/booking/train/search?fromcity=Dhaka&tocity=Santahar&doj=25-May-2025&class=S_CHAIR",
      SEAT_COUNT: 1,
      PREFER_TIME_RANGE: ["20:45", "23:30"],
      PREFER_SEAT: ["S_CHAIR"],
    }
    try {
      await buy_ticket(config)
    } catch (error) {
      await buy_ticket(config)
    }
  },
  {
    timezone: "Asia/Dhaka",
  }
)

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
  PREFER_TIME_RANGE: [string, string]
  PREFER_SEAT: string[]
}

const buy_ticket = async ({
  URL,
  SEAT_COUNT,
  PREFER_TIME_RANGE,
  PREFER_TRAIN_NAME,
  PREFER_SEAT,
}: BuyTicketParams) => {
  const trip_obj = {} as TripObjectI

  try {
    const browser = await puppeteer.launch({
      headless: false,
    })
    const page = await browser.newPage()

    await page.goto(URL, {
      waitUntil: "networkidle2",
      timeout: 0,
    })

    const trips_ = await get_trips({
      page,
      PREFER_TIME_RANGE: PREFER_TIME_RANGE,
    })

    console.log(trips_.length, "trips found")

    for (let i = 0; i < trips_.length; i++) {
      const trip = trips_[i]

      const seat_class_container = await trip.$$(SEAT_CLASS_CONTAINER_SELECTOR)

      const seat_details_promises = seat_class_container.map(async (seat) => {
        const seat_type = await seat.$eval(
          SEAT_TYPE_SELECTOR,
          (elem) => elem.innerText
        )

        return seat_type
      })
      const seat_details = await Promise.all(seat_details_promises)
      const S_CHAIR_INDEX = seat_details.indexOf("S_CHAIR")

      if (seat_class_container[S_CHAIR_INDEX]) {
        const book_now_btn = await seat_class_container[S_CHAIR_INDEX].$(
          BOOK_NOW_BUTTON_SELECTOR
        )
        if (!book_now_btn) continue
        await book_now_btn.click()

        await login({
          page,
          phone: config.phone,
          password: config.password,
        })

        await book_now_btn.click()

        const selected_bogie_value = await get_bogie({
          page,
          already_checked_bogies: [],
        })
        await page.select("select#select-bogie", selected_bogie_value)

        const available_seats = await get_available_seat_buttons({
          page,
        })

        // random seat selection
        if (available_seats.seat_availability <= SEAT_COUNT)
          throw Error("No free seats available")

        const random_seat_selected_index_array = new Set<{
          seat_index: number
          seat_number: string
        }>()

        while (random_seat_selected_index_array.size < SEAT_COUNT) {
          const random_index = Math.floor(
            Math.random() * available_seats.seat_availability
          )
          const seat_number = await available_seats.available_seats_buttons[
            random_index
          ].evaluate((el) => el.innerText)
          random_seat_selected_index_array.add({
            seat_index: random_index,
            seat_number,
          })
        }

        break
      }
    }

    return

    const selected_bogie_value = await get_bogie({
      page,
      already_checked_bogies: [],
    })
    await page.select("select#select-bogie", selected_bogie_value)

    const available_seats = await get_available_seat_buttons({
      page,
    })

    // random seat selection
    if (available_seats.seat_availability <= SEAT_COUNT)
      throw Error("No free seats available")
    console.log(`Total Free Seats: ${available_seats.seat_availability}`)

    const random_seat_selected_index_array = new Set<{
      seat_index: number
      seat_number: string
    }>()

    while (random_seat_selected_index_array.size < SEAT_COUNT) {
      const random_index = Math.floor(
        Math.random() * available_seats.seat_availability
      )
      const seat_number = await available_seats.available_seats_buttons[
        random_index
      ].evaluate((el) => el.innerText)
      random_seat_selected_index_array.add({
        seat_index: random_index,
        seat_number,
      })
    }

    console.log(random_seat_selected_index_array)

    return
    random_seat_selected_index_array.forEach(async (seat) => {
      await available_seats.available_seats_buttons[seat.seat_index].click()
    })

    return

    const continue_btn = await page.waitForSelector("button.continue-btn", {
      timeout: 10000,
    })

    if (!continue_btn) throw Error("Continue Purchase Button Element Not Found")
    await continue_btn.click()
  } catch (error) {
    if (error instanceof Error) {
      console.error(error)
    }
  }
}
