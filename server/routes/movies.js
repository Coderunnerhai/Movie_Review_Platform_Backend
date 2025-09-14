const express = require('express');
const axios = require('axios');
const { body, validationResult, query } = require('express-validator');
const { Movie, Review } = require('../models');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// @route   GET /api/movies
// @desc    Get all movies with pagination and filtering
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('genre').optional().isString().withMessage('Genre must be a string'),
  query('year').optional().isInt({ min: 1888 }).withMessage('Year must be a valid year'),
  query('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('sort').optional().isIn(['title', 'releaseYear', 'averageRating', 'createdAt']).withMessage('Invalid sort field')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (req.query.genre) {
      filter.genre = { $in: [req.query.genre] };
    }
    
    if (req.query.year) {
      filter.releaseYear = parseInt(req.query.year);
    }
    
    if (req.query.rating) {
      filter.averageRating = { $gte: parseFloat(req.query.rating) };
    }
    
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Build sort object
    const sort = {};
    if (req.query.sort) {
      sort[req.query.sort] = req.query.sort === 'releaseYear' ? -1 : 1;
    } else {
      sort.averageRating = -1; // Default sort by rating
    }

    const movies = await Movie.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('reviews', 'rating reviewText createdAt')
      .lean();

    const total = await Movie.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      movies,
      pagination: {
        currentPage: page,
        totalPages,
        totalMovies: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/movies/trending
// @desc    Get trending movies
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const movies = await Movie.find({})
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(10)
      .lean();

    res.json({ movies });
  } catch (error) {
    console.error('Get trending movies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/movies/featured
// @desc    Get featured movies
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const featuredMovies = await Movie.find({})
      .sort({ averageRating: -1 })
      .limit(6)
      .lean();

    res.json({ movies: featuredMovies });
  } catch (error) {
    console.error('Get featured movies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/movies/:id
// @desc    Get a specific movie with reviews
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      
      .lean();

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json({ movie });
  } catch (error) {
    console.error('Get movie error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/movies
// @desc    Add a new movie (admin only)
// @access  Private (Admin)
router.post('/', [
  authMiddleware,
  adminMiddleware,
  body('title').notEmpty().withMessage('Title is required'),
  body('genre').isArray({ min: 1 }).withMessage('At least one genre is required'),
  body('releaseYear').isInt({ min: 1888 }).withMessage('Valid release year is required'),
  body('director').notEmpty().withMessage('Director is required'),
  body('cast').isArray({ min: 1 }).withMessage('At least one cast member is required'),
  body('synopsis').notEmpty().withMessage('Synopsis is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const movieData = req.body;
    
    // Check if movie already exists
    const existingMovie = await Movie.findOne({ title: movieData.title, releaseYear: movieData.releaseYear });
    if (existingMovie) {
      return res.status(400).json({ message: 'Movie already exists' });
    }

    const movie = new Movie(movieData);
    await movie.save();

    res.status(201).json({
      message: 'Movie added successfully',
      movie
    });
  } catch (error) {
    console.error('Add movie error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/movies/tmdb/:tmdbId
// @desc    Add movie from TMDB
// @access  Private (Admin)
router.post('/tmdb/:tmdbId', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    if (!TMDB_API_KEY) {
      return res.status(500).json({ message: 'TMDB API key not configured' });
    }

    const { tmdbId } = req.params;

    // Check if movie already exists
    const existingMovie = await Movie.findOne({ tmdbId: parseInt(tmdbId) });
    if (existingMovie) {
      return res.status(400).json({ message: 'Movie already exists' });
    }

    // Fetch movie details from TMDB
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${tmdbId}`, {
      params: { api_key: TMDB_API_KEY }
    });

    const tmdbMovie = response.data;

    // Fetch cast details
    const castResponse = await axios.get(`${TMDB_BASE_URL}/movie/${tmdbId}/credits`, {
      params: { api_key: TMDB_API_KEY }
    });

    const movieData = {
      title: tmdbMovie.title,
      genre: tmdbMovie.genres.map(g => g.name),
      releaseYear: new Date(tmdbMovie.release_date).getFullYear(),
      director: castResponse.data.crew.find(person => person.job === 'Director')?.name || 'Unknown',
      cast: castResponse.data.cast.slice(0, 10).map(actor => ({
        name: actor.name,
        character: actor.character
      })),
      synopsis: tmdbMovie.overview,
      posterUrl: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : null,
      backdropUrl: tmdbMovie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbMovie.backdrop_path}` : null,
      duration: tmdbMovie.runtime,
      tmdbId: tmdbMovie.id,
      imdbId: tmdbMovie.imdb_id
    };

    const movie = new Movie(movieData);
    await movie.save();

    res.status(201).json({
      message: 'Movie added successfully from TMDB',
      movie
    });
  } catch (error) {
    console.error('Add TMDB movie error:', error);
    if (error.response?.status === 404) {
      res.status(404).json({ message: 'Movie not found on TMDB' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// @route   PUT /api/movies/:id
// @desc    Update a movie (admin only)
// @access  Private (Admin)
router.put('/:id', [
  authMiddleware,
  adminMiddleware,
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('genre').optional().isArray({ min: 1 }).withMessage('At least one genre is required'),
  body('releaseYear').optional().isInt({ min: 1888 }).withMessage('Valid release year is required'),
  body('director').optional().notEmpty().withMessage('Director cannot be empty'),
  body('cast').optional().isArray({ min: 1 }).withMessage('At least one cast member is required'),
  body('synopsis').optional().notEmpty().withMessage('Synopsis cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json({
      message: 'Movie updated successfully',
      movie
    });
  } catch (error) {
    console.error('Update movie error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/movies/:id
// @desc    Delete a movie (admin only)
// @access  Private (Admin)
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json({ message: 'Movie deleted successfully' });
  } catch (error) {
    console.error('Delete movie error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;











