import { Page } from "puppeteer"
import get_available_seat_buttons from "./get-available-seat-buttons"

type GetAvailableSeatButtonsParams = {
  page: Page
  already_checked_bogies: string[] // those bogies which are checked previously
}

export default async function get_bogie({
  page,
  already_checked_bogies,
}: GetAvailableSeatButtonsParams) {
  const bogie_select_el = await page.waitForSelector("select#select-bogie", {
    timeout: 10000,
  })
  if (!bogie_select_el) throw Error("Bogie Select Element Not Found")
  let bogie_name: string

  const selected_bogie_value = await bogie_select_el.$$eval(
    "option",
    (bogies, already_checked_bogies) => {
      const bogie_value = bogies.find((bogie) => {
        const seat_count = +bogie.innerText.split(" ")[2]
        if (already_checked_bogies.includes(bogie.value)) return false
        console.log("Bogie Name:", bogie.innerText)
        return seat_count > 0
      })

      return bogie_value ? bogie_value.value : null
    },
    already_checked_bogies
  )

  if (!selected_bogie_value) throw Error("bogie value not find")
  // await page.select("select#select-bogie", selected_bogie_value)

  return selected_bogie_value

}
