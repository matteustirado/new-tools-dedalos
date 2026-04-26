import express from 'express'
import {
  listTracks,
  fetchYoutubeData,
  addTrack,
  updateTrack,
  deleteTrack,
  deleteMultipleTracks
} from '../controllers/trackController.js'

const router = express.Router()

router.get('/', listTracks)
router.post('/fetch-data', fetchYoutubeData)
router.post('/import', addTrack)
router.put('/:id', updateTrack)
router.delete('/batch', deleteMultipleTracks)
router.delete('/:id', deleteTrack)

export default router