import db from './connection.js';

async function addReviews() {
  const pool = db();
  
  try {
    console.log('Adding more reviews...');
    
    await pool.query(`
      INSERT INTO reviews (name, rating, title, review_text, is_verified) VALUES
      ('Tom B.', 5, 'Transformed my career prospects', 'I was stuck in retail but always wanted to move into tech. Wurlo helped me build the math foundation I needed. Now I''m in a junior analyst role making 40% more!', true),
      ('Rachel W.', 5, 'So much better than textbooks', 'Tried teaching myself from books and got nowhere. Wurlo''s adaptive approach is brilliant - it knows exactly what I need to learn next. Actually enjoying math for the first time!', true),
      ('James L.', 5, 'Perfect for my commute', 'The 15-minute lessons are perfect. I learn on my train commute and I''ve covered more in 2 months than I did in years of trying. The podcasts are a game changer.', true)
    `);
    
    console.log('✅ Added 3 more reviews');
    
    // Verify total
    const result = await pool.query('SELECT COUNT(*) as count FROM reviews');
    console.log(`📊 Total reviews now: ${result.rows[0].count}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

addReviews();
