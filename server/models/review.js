const mongoose = require('mongoose');
const { Review, Movie } = require('../models');

const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  rating: { type: Number, required: true },
  reviewText: { type: String, required: true },
  helpfulVotes: { type: Number, default: 0 }
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;