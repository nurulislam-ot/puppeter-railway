import { TZDate } from "@date-fns/tz"
import { ElementHandle, Page } from "puppeteer"
import {
  DEPARTURE_DATE_TIME_SELECTOR,
  SEAT_AVAILABILITY_SELECTOR,
  SEAT_CLASS_CONTAINER_SELECTOR,
  SEAT_TYPE_SELECTOR,
} from "./constant/selector"
import is_this_hour_in_prefer_time_range from "./utils/is-this-hour-in-prefer-time-range"

type GetTripsParams = {
  page: Page
  PREFER_TIME_RANGE: [string, string]
}

export default async function get_trips({
  page,
  PREFER_TIME_RANGE,
}: GetTripsParams) {
  const trips = await page.$$("app-single-trip")
  const filtered_trips: ElementHandle<Element>[] = []

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i]
    const departure_date_time_string = await trip.$eval(
      DEPARTURE_DATE_TIME_SELECTOR,
      (element) => element.innerText
    )
    const custom_departure_date_time = departure_date_time_string.replace(
      ",",
      "2025"
    )

    const departure_date_time = new TZDate(
      custom_departure_date_time,
      "Asia/Dhaka"
    )

    const seat_class_container = await trip.$$(SEAT_CLASS_CONTAINER_SELECTOR)

    const seat_availability_promises = seat_class_container.map(
      async (seat) => {
        const seat_type = await seat.$eval(
          SEAT_TYPE_SELECTOR,
          (elem) => elem.innerText
        )

        const seat_availability = await seat.$eval(
          SEAT_AVAILABILITY_SELECTOR,
          (elem) => elem.innerText
        )

        return {
          seat_type,
          seat_availability: parseInt(seat_availability, 10),
        }
      }
    )

    const seat_availability = await Promise.all(seat_availability_promises)

    const is_any_seat_available = seat_availability.reduce((acc, curr) => {
      if (curr.seat_type === "S_CHAIR" && curr.seat_availability > 0) {
        return true
      }
      return acc
    }, false)

    const condition = is_this_hour_in_prefer_time_range(
      departure_date_time,
      PREFER_TIME_RANGE
    )

    if (is_any_seat_available && condition) {
      filtered_trips.unshift(trip)
    }
  }

  return filtered_trips
}
