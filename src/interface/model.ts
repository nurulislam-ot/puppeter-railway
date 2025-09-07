type Trip = {
  train_name: string
  active_user: string
  departure_date_time: Date
  S_CHAIR: Bogie[]
  AC_BOGIE: Bogie[]
  SNIGDHA: Bogie[]
}

type Bogie = {
  bogie_name: string
  seat_availability: string
  available_seats_buttons: Element[]
}

export default Trip
