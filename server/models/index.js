const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profilePicture: {
    type: String,
    default: null
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Movie Schema
const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  genre: [{
    type: String,
    required: true
  }],
  releaseYear: {
    type: Number,
    required: true,
    min: 1888,
    max: new Date().getFullYear() + 5
  },
  director: {
    type: String,
    required: true,
    trim: true
  },
  cast: [{
    name: {
      type: String,
      required: true
    },
    character: String
  }],
  synopsis: {
    type: String,
    required: true,
    maxlength: 2000
  },
  posterUrl: {
    type: String,
    default: null
  },
  backdropUrl: {
    type: String,
    default: null
  },
  trailerUrl: {
    type: String,
    default: null
  },
  duration: {
    type: Number, // in minutes
    default: null
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  tmdbId: {
    type: Number,
    unique: true,
    sparse: true
  },
  imdbId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Review Schema
const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    required: true,
    maxlength: 2000
  },
  helpfulVotes: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Watchlist Schema
const watchlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['want_to_watch', 'watching', 'watched'],
    default: 'want_to_watch'
  }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

movieSchema.index({ title: 'text', synopsis: 'text' });
movieSchema.index({ genre: 1 });
movieSchema.index({ releaseYear: 1 });
movieSchema.index({ averageRating: -1 });
movieSchema.index({ tmdbId: 1 });

reviewSchema.index({ userId: 1, movieId: 1 }, { unique: true });
reviewSchema.index({ movieId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });

watchlistSchema.index({ userId: 1, movieId: 1 }, { unique: true });
watchlistSchema.index({ userId: 1, dateAdded: -1 });

// Static method to calculate average rating
movieSchema.statics.calculateAverageRating = async function(movieId) {
  const result = await this.aggregate([
    { $match: { _id: movieId } },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'movieId',
        as: 'reviews'
      }
    },
    {
      $addFields: {
        averageRating: { $avg: '$reviews.rating' },
        totalReviews: { $size: '$reviews' }
      }
    }
  ]);

  if (result.length > 0) {
    await this.findByIdAndUpdate(movieId, {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalReviews
    });
  }
};

// Middleware to update average rating after review changes
reviewSchema.post('save', async function() {
  await mongoose.model('Movie').calculateAverageRating(this.movieId);
});

reviewSchema.post('findOneAndDelete', async function() {
  if (this.movieId) {
    await mongoose.model('Movie').calculateAverageRating(this.movieId);
  }
});

const User = mongoose.model('User', userSchema);
const Movie = mongoose.model('Movie', movieSchema);
const Review = mongoose.model('Review', reviewSchema);
const Watchlist = mongoose.model('Watchlist', watchlistSchema);

module.exports = {
  User,
  Movie,
  Review,
  Watchlist
};











