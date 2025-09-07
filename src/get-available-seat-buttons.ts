import { Page } from "puppeteer"

type GetAvailableSeatButtonsParams = {
  page: Page
}

export default async function get_available_seat_buttons({
  page,
}: GetAvailableSeatButtonsParams) {
  const available_seats_buttons = await page.$$("button.seat-available")

  return {
    available_seats_buttons,
    seat_availability: available_seats_buttons.length,
  }
}
