const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const { User, Movie, Review, Watchlist } = require('./models');

// Sample data
const sampleUsers = [
  {
    username: 'admin',
    email: 'admin@moviereview.com',
    password: 'admin123',
    isAdmin: true,
    profilePicture: null
  },
  {
    username: 'movielover',
    email: 'user1@example.com',
    password: 'password123',
    isAdmin: false,
    profilePicture: null
  },
  {
    username: 'cinemafan',
    email: 'user2@example.com',
    password: 'password123',
    isAdmin: false,
    profilePicture: null
  },
  {
    username: 'filmcritic',
    email: 'user3@example.com',
    password: 'password123',
    isAdmin: false,
    profilePicture: null
  }
];

const sampleMovies = [
  {
    title: 'The Shawshank Redemption',
    genre: ['Drama'],
    releaseYear: 1994,
    director: 'Frank Darabont',
    cast: [
      { name: 'Tim Robbins', character: 'Andy Dufresne' },
      { name: 'Morgan Freeman', character: 'Ellis Boyd "Red" Redding' },
      { name: 'Bob Gunton', character: 'Warden Norton' }
    ],
    synopsis: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
    duration: 142,
    averageRating: 0,
    totalReviews: 0
  },
  {
    title: 'The Godfather',
    genre: ['Crime', 'Drama'],
    releaseYear: 1972,
    director: 'Francis Ford Coppola',
    cast: [
      { name: 'Marlon Brando', character: 'Don Vito Corleone' },
      { name: 'Al Pacino', character: 'Michael Corleone' },
      { name: 'James Caan', character: 'Sonny Corleone' }
    ],
    synopsis: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    duration: 175,
    averageRating: 0,
    totalReviews: 0
  },
  {
    title: 'The Dark Knight',
    genre: ['Action', 'Crime', 'Drama'],
    releaseYear: 2008,
    director: 'Christopher Nolan',
    cast: [
      { name: 'Christian Bale', character: 'Bruce Wayne / Batman' },
      { name: 'Heath Ledger', character: 'Joker' },
      { name: 'Aaron Eckhart', character: 'Harvey Dent' }
    ],
    synopsis: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    duration: 152,
    averageRating: 0,
    totalReviews: 0
  },
  {
    title: 'Pulp Fiction',
    genre: ['Crime', 'Drama'],
    releaseYear: 1994,
    director: 'Quentin Tarantino',
    cast: [
      { name: 'John Travolta', character: 'Vincent Vega' },
      { name: 'Samuel L. Jackson', character: 'Jules Winnfield' },
      { name: 'Uma Thurman', character: 'Mia Wallace' }
    ],
    synopsis: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
    duration: 154,
    averageRating: 0,
    totalReviews: 0
  },
  {
    title: 'Forrest Gump',
    genre: ['Drama', 'Romance'],
    releaseYear: 1994,
    director: 'Robert Zemeckis',
    cast: [
      { name: 'Tom Hanks', character: 'Forrest Gump' },
      { name: 'Robin Wright', character: 'Jenny Curran' },
      { name: 'Gary Sinise', character: 'Lieutenant Dan Taylor' }
    ],
    synopsis: 'The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/saHP97rTPS5eLmrLQEcANmKrsFl.jpg',
    duration: 142,
    averageRating: 0,
    totalReviews: 0
  },
  {
    title: 'Inception',
    genre: ['Action', 'Sci-Fi', 'Thriller'],
    releaseYear: 2010,
    director: 'Christopher Nolan',
    cast: [
      { name: 'Leonardo DiCaprio', character: 'Cobb' },
      { name: 'Marion Cotillard', character: 'Mal' },
      { name: 'Tom Hardy', character: 'Eames' }
    ],
    synopsis: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
    duration: 148,
    averageRating: 0,
    totalReviews: 0
  },
  {
    title: 'The Matrix',
    genre: ['Action', 'Sci-Fi'],
    releaseYear: 1999,
    director: 'Lana Wachowski',
    cast: [
      { name: 'Keanu Reeves', character: 'Neo' },
      { name: 'Laurence Fishburne', character: 'Morpheus' },
      { name: 'Carrie-Anne Moss', character: 'Trinity' }
    ],
    synopsis: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    duration: 136,
    averageRating: 0,
    totalReviews: 0
  },
  {
    title: 'Goodfellas',
    genre: ['Biography', 'Crime', 'Drama'],
    releaseYear: 1990,
    director: 'Martin Scorsese',
    cast: [
      { name: 'Robert De Niro', character: 'James Conway' },
      { name: 'Ray Liotta', character: 'Henry Hill' },
      { name: 'Joe Pesci', character: 'Tommy DeVito' }
    ],
    synopsis: 'The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg',
    duration: 146,
    averageRating: 0,
    totalReviews: 0
  }
];

const sampleReviews = [
  {
    rating: 5,
    reviewText: 'An absolute masterpiece! The storytelling is incredible and the character development is outstanding. This movie changed my perspective on life.',
    helpfulVotes: 12
  },
  {
    rating: 4,
    reviewText: 'Great movie with excellent acting and direction. Some parts were a bit slow but overall very enjoyable.',
    helpfulVotes: 8
  },
  {
    rating: 5,
    reviewText: 'One of the best movies I have ever seen. The cinematography is beautiful and the story is compelling.',
    helpfulVotes: 15
  },
  {
    rating: 3,
    reviewText: 'Decent movie but not as good as I expected. The plot was predictable and the acting was average.',
    helpfulVotes: 3
  },
  {
    rating: 4,
    reviewText: 'Solid film with good performances. The ending was a bit disappointing but overall worth watching.',
    helpfulVotes: 6
  },
  {
    rating: 5,
    reviewText: 'Brilliant! This movie deserves all the praise it gets. The direction and acting are top-notch.',
    helpfulVotes: 20
  },
  {
    rating: 2,
    reviewText: 'Not my cup of tea. The story was confusing and the characters were not well developed.',
    helpfulVotes: 1
  },
  {
    rating: 4,
    reviewText: 'Good movie with interesting plot twists. The visual effects were impressive.',
    helpfulVotes: 7
  }
];

const sampleWatchlistItems = [
  { status: 'want_to_watch' },
  { status: 'watching' },
  { status: 'watched' },
  { status: 'want_to_watch' },
  { status: 'watched' }
];

// Seed function
async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/movie_reviews');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Movie.deleteMany({});
    await Review.deleteMany({});
    await Watchlist.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const users = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      users.push(user);
    }
    console.log(`Created ${users.length} users`);

    // Create movies
    const movies = [];
    for (const movieData of sampleMovies) {
      const movie = new Movie(movieData);
      await movie.save();
      movies.push(movie);
    }
    console.log(`Created ${movies.length} movies`);

    // Create reviews
    const reviews = [];
for (let i = 0; i < movies.length; i++) {
  const movie = movies[i];
  const numReviews = Math.floor(Math.random() * 4) + 2; // 2-5 reviews per movie

  const usedPairs = new Set(); // track which user-movie pairs exist

  for (let j = 0; j < numReviews; j++) {
    const user = users[Math.floor(Math.random() * (users.length - 1)) + 1]; // skip admin
    const reviewData = sampleReviews[Math.floor(Math.random() * sampleReviews.length)];

    const pairKey = `${user._id}_${movie._id}`;
    if (usedPairs.has(pairKey)) continue; // skip duplicate
    usedPairs.add(pairKey);

    const review = new Review({
      userId: user._id,
      movieId: movie._id,
      ...reviewData
    });

    await review.save();
    reviews.push(review);
  }
}
    console.log(`Created ${reviews.length} reviews`);

    // Update movie ratings
    for (const movie of movies) {
      await Movie.calculateAverageRating(movie._id);
    }
    console.log('Updated movie ratings');

    // Create watchlist items
    const watchlistItems = [];
    for (let i = 0; i < 10; i++) {
      const user = users[Math.floor(Math.random() * (users.length - 1)) + 1]; // Skip admin
      const movie = movies[Math.floor(Math.random() * movies.length)];
      const statusData = sampleWatchlistItems[Math.floor(Math.random() * sampleWatchlistItems.length)];
      
      const watchlistItem = new Watchlist({
        userId: user._id,
        movieId: movie._id,
        ...statusData
      });
      
      await watchlistItem.save();
      watchlistItems.push(watchlistItem);
    }
    console.log(`Created ${watchlistItems.length} watchlist items`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nSample accounts:');
    console.log('Admin: admin@moviereview.com / admin123');
    console.log('User: user1@example.com / password123');
    console.log('User: user2@example.com / password123');
    console.log('User: user3@example.com / password123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run seed function
module.exports = seedDatabase;








