const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Review, Watchlist } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/:id
// @desc    Get user profile and review history
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get user profile
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's reviews
    const reviews = await Review.find({ userId: id })
      .populate('movieId', 'title posterUrl releaseYear')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReviews = await Review.countDocuments({ userId: id });

    // Get user's watchlist stats
    const watchlistStats = await Watchlist.aggregate([
      { $match: { userId: id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      want_to_watch: 0,
      watching: 0,
      watched: 0,
      total: 0
    };

    watchlistStats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        joinDate: user.joinDate,
        isAdmin: user.isAdmin
      },
      reviews: {
        data: reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalReviews / limit),
          totalReviews,
          hasNext: page < Math.ceil(totalReviews / limit),
          hasPrev: page > 1
        }
      },
      watchlistStats: formattedStats
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private
router.put('/:id', [
  authMiddleware,
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('profilePicture')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const userId = req.user._id;

    // Check if user is updating their own profile or is admin
    if (id !== userId.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { username, email, profilePicture } = req.body;
    const updateData = {};

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

    // Check if username or email already exists (excluding current user)
    if (username || email) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : [])
        ]
      });

      if (existingUser) {
        return res.status(400).json({ 
          message: existingUser.username === username ? 'Username already taken' : 'Email already registered'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        joinDate: user.joinDate,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/reviews
// @desc    Get user's reviews with pagination
// @access  Public
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reviews = await Review.find({ userId: id })
      .populate('movieId', 'title posterUrl releaseYear averageRating genre')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Review.countDocuments({ userId: id });
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

// @route   GET /api/users/:id/watchlist
// @desc    Get user's watchlist
// @access  Public
router.get('/:id/watchlist', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const filter = { userId: id };
    if (status) {
      filter.status = status;
    }

    const watchlist = await Watchlist.find(filter)
      .populate('movieId', 'title posterUrl releaseYear averageRating genre')
      .sort({ dateAdded: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Watchlist.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      watchlist,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/stats
// @desc    Get user statistics
// @access  Public
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get review statistics
    const reviewStats = await Review.aggregate([
      { $match: { userId: id } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    // Get watchlist statistics
    const watchlistStats = await Watchlist.aggregate([
      { $match: { userId: id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedWatchlistStats = {
      want_to_watch: 0,
      watching: 0,
      watched: 0,
      total: 0
    };

    watchlistStats.forEach(stat => {
      formattedWatchlistStats[stat._id] = stat.count;
      formattedWatchlistStats.total += stat.count;
    });

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (reviewStats.length > 0 && reviewStats[0].ratingDistribution) {
      reviewStats[0].ratingDistribution.forEach(rating => {
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });
    }

    res.json({
      stats: {
        totalReviews: reviewStats.length > 0 ? reviewStats[0].totalReviews : 0,
        averageRating: reviewStats.length > 0 ? Math.round(reviewStats[0].averageRating * 10) / 10 : 0,
        ratingDistribution,
        watchlistStats: formattedWatchlistStats
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;










