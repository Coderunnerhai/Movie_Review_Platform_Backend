const express = require('express');
const { body, validationResult } = require('express-validator');
const { Review, Movie } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/reviews
// @desc    Submit a new review for a movie
// @access  Private
router.post('/', [
  authMiddleware,
  body('movieId').isMongoId().withMessage('Valid movie ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('reviewText').isLength({ min: 10, max: 2000 }).withMessage('Review text must be between 10 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { movieId, rating, reviewText } = req.body;
    const userId = req.user._id;

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if user already reviewed this movie
    const existingReview = await Review.findOne({ userId, movieId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this movie' });
    }

    // Create new review
    const review = new Review({
      userId,
      movieId,
      rating,
      reviewText
    });

    await review.save();

    // Populate the review with user data
    await review.populate('userId', 'username profilePicture');

    res.status(201).json({
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reviews/movie/:movieId
// @desc    Get reviews for a specific movie
// @access  Public
router.get('/movie/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    const reviews = await Review.find({ movieId })
      .populate('userId', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Review.countDocuments({ movieId });
    const totalPages = Math.ceil(total / limit);

    res.json({
      reviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get movie reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reviews/user/:userId
// @desc    Get reviews by a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ userId })
      .populate('movieId', 'title posterUrl releaseYear')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Review.countDocuments({ userId });
    const totalPages = Math.ceil(total / limit);

    res.json({
      reviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reviews/my-reviews
// @desc    Get current user's reviews
// @access  Private
router.get('/my-reviews', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ userId })
      .populate('movieId', 'title posterUrl releaseYear')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Review.countDocuments({ userId });
    const totalPages = Math.ceil(total / limit);

    res.json({
      reviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reviews/:reviewId
// @desc    Update a review
// @access  Private
router.put('/:reviewId', [
  authMiddleware,
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('reviewText').optional().isLength({ min: 10, max: 2000 }).withMessage('Review text must be between 10 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOne({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const updateData = {};
    if (req.body.rating !== undefined) updateData.rating = req.body.rating;
    if (req.body.reviewText !== undefined) updateData.reviewText = req.body.reviewText;

    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'username profilePicture');

    res.json({
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/reviews/:reviewId
// @desc    Delete a review
// @access  Private
router.delete('/:reviewId', authMiddleware, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOneAndDelete({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/reviews/:reviewId/helpful
// @desc    Mark a review as helpful
// @access  Private
router.post('/:reviewId/helpful', authMiddleware, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Increment helpful votes
    review.helpfulVotes += 1;
    await review.save();

    res.json({
      message: 'Review marked as helpful',
      helpfulVotes: review.helpfulVotes
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;






