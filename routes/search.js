const search_controller = require('../controller/search')

const router = require('express').Router()

router.get('/search/trip', search_controller.search)

module.exports = router
