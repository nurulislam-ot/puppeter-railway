import { setHours, setMinutes } from "date-fns"

export default function is_this_hour_in_prefer_time_range(
  hour: Date,
  prefer_time_range: [string, string]
): boolean {
  const [start, end] = prefer_time_range.map((time) => {
    const [h, m] = time.split(":").map(Number)
    const start_date = setHours(hour, h)
    return setMinutes(start_date, m)
  })
  return hour >= start && hour <= end
}
