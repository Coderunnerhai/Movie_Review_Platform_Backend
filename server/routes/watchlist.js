const express = require('express');
const { body, validationResult } = require('express-validator');
const { Watchlist, Movie } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/watchlist
// @desc    Get user's watchlist
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status; // want_to_watch, watching, watched

    const filter = { userId };
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
    console.error('Get watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/watchlist
// @desc    Add movie to watchlist
// @access  Private
router.post('/', [
  authMiddleware,
  body('movieId').isMongoId().withMessage('Valid movie ID is required'),
  body('status').optional().isIn(['want_to_watch', 'watching', 'watched']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { movieId, status = 'want_to_watch' } = req.body;
    const userId = req.user._id;

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if already in watchlist
    const existingItem = await Watchlist.findOne({ userId, movieId });
    if (existingItem) {
      return res.status(400).json({ message: 'Movie already in watchlist' });
    }

    // Add to watchlist
    const watchlistItem = new Watchlist({
      userId,
      movieId,
      status
    });

    await watchlistItem.save();
    await watchlistItem.populate('movieId', 'title posterUrl releaseYear averageRating genre');

    res.status(201).json({
      message: 'Movie added to watchlist successfully',
      watchlistItem
    });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/watchlist/:movieId
// @desc    Update watchlist item status
// @access  Private
router.put('/:movieId', [
  authMiddleware,
  body('status').isIn(['want_to_watch', 'watching', 'watched']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { movieId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    const watchlistItem = await Watchlist.findOneAndUpdate(
      { userId, movieId },
      { status },
      { new: true, runValidators: true }
    ).populate('movieId', 'title posterUrl releaseYear averageRating genre');

    if (!watchlistItem) {
      return res.status(404).json({ message: 'Watchlist item not found' });
    }

    res.json({
      message: 'Watchlist item updated successfully',
      watchlistItem
    });
  } catch (error) {
    console.error('Update watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/watchlist/:movieId
// @desc    Remove movie from watchlist
// @access  Private
router.delete('/:movieId', authMiddleware, async (req, res) => {
  try {
    const { movieId } = req.params;
    const userId = req.user._id;

    const watchlistItem = await Watchlist.findOneAndDelete({ userId, movieId });
    if (!watchlistItem) {
      return res.status(404).json({ message: 'Watchlist item not found' });
    }

    res.json({ message: 'Movie removed from watchlist successfully' });
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/watchlist/check/:movieId
// @desc    Check if movie is in user's watchlist
// @access  Private
router.get('/check/:movieId', authMiddleware, async (req, res) => {
  try {
    const { movieId } = req.params;
    const userId = req.user._id;

    const watchlistItem = await Watchlist.findOne({ userId, movieId });
    
    res.json({
      inWatchlist: !!watchlistItem,
      status: watchlistItem?.status || null
    });
  } catch (error) {
    console.error('Check watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/watchlist/stats
// @desc    Get watchlist statistics
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Watchlist.aggregate([
      { $match: { userId } },
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

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    res.json({ stats: formattedStats });
  } catch (error) {
    console.error('Get watchlist stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;











