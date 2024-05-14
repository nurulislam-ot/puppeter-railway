const puppeteer = require('puppeteer')
const express = require('express')
const search_router = require('./routes/search')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/api', search_router)

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
