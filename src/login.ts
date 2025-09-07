import { Page } from "puppeteer"

type LoginParams = {
  page: Page

  phone: string
  password: string
}

function delay(time: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  })
}

export default async function login({ page, password, phone }: LoginParams) {
  const modal = await page.waitForSelector(".login-modal-form")
  if (modal) {
    const mobileInput = await modal.$("#mobile_number")
    if (!mobileInput) throw new Error("Mobile input not found")
    await mobileInput.type(phone)

    const passwordInput = await modal.$("#trainAppLoginPassword")
    if (!passwordInput) throw new Error("Password input not found")
    await passwordInput.type(password)

    const loginButton = await modal.$('[type="submit"]')
    if (loginButton) await loginButton.click()

    // Wait for the login modal to be hidden after clicking the login button
    await page.waitForSelector(".login-modal-form", {
      hidden: true,
    })
  }
}
