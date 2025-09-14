const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  genre: [String],
  releaseYear: Number,
  director: String,
  cast: [{ name: String, character: String }],
  synopsis: String,
  posterUrl: String,
  backdropUrl: String,
  duration: Number,
  tmdbId: Number,
  imdbId: String,
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual field for reviews
movieSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'movieId'
});

module.exports = mongoose.model('Movie', movieSchema);