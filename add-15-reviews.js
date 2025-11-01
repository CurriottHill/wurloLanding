import db from './connection.js';

async function add15Reviews() {
  const pool = db();
  
  try {
    console.log('Adding 15 new reviews...');
    
    await pool.query(`
      INSERT INTO reviews (name, rating, title, review_text, is_verified) VALUES
      ('Sarah M.', 5, 'Finally understanding calculus!', 'I''ve struggled with calculus for years. Wurlo broke it down in a way that just clicked. The adaptive lessons met me where I was and built my confidence step by step.', true),
      ('David K.', 5, 'Game changer for my degree', 'Halfway through my engineering degree and drowning in math. Wurlo saved me. The AI knows exactly what I need to review and what I''m ready for next. Absolute lifesaver!', true),
      ('Emma T.', 4, 'Wish I had this in school', 'So much better than YouTube tutorials. Everything is structured perfectly and adapts to my pace. Only complaint is I want MORE content!', true),
      ('Michael R.', 5, 'From math-phobic to confident', 'Always avoided anything with numbers. Started with basic algebra on Wurlo and now I''m working through statistics. The bite-sized approach makes it actually fun.', true),
      ('Lisa P.', 5, 'Perfect for career switching', 'Transitioning from teaching to data science. Wurlo filled all my math gaps in 3 months. The progress tracking kept me motivated every single day.', true),
      ('Alex H.', 5, 'Best £29 I''ve ever spent', 'Tried Khan Academy, Coursera, everything. Nothing compares to how Wurlo adapts to YOUR learning. Worth every penny and then some.', true),
      ('Sophie C.', 5, 'Making math make sense', 'The way concepts build on each other is genius. I finally understand WHY formulas work, not just how to use them. Revolutionary approach to learning.', true),
      ('Daniel F.', 4, 'Highly recommend', 'Solid platform with great content. The AI is impressively accurate at finding my weak spots. Would love to see more practice problems added.', true),
      ('Jessica N.', 5, 'Passed my exam thanks to Wurlo', 'Had my stats exam in 2 weeks and was panicking. Wurlo''s focused approach got me from failing practice tests to scoring 87%. Unbelievable!', true),
      ('Ryan G.', 5, 'Actually enjoying learning again', 'Never thought I''d say this about math, but the lessons are genuinely engaging. The AI feels like having a patient tutor available 24/7.', true),
      ('Olivia S.', 5, 'The future of education', 'This is what adaptive learning should be. Every lesson is perfectly tailored. My university should just use this instead of lectures!', true),
      ('Marcus J.', 5, 'Incredible value', 'Lifetime access for less than one tutoring session? Plus it''s way more effective than my old tutor. This is the real deal.', true),
      ('Hannah D.', 4, 'Great for self-paced learning', 'Love that I can go at my own speed. Some days I do 30 minutes, some days 2 hours. Always picks up exactly where I left off.', true),
      ('Ben W.', 5, 'Helped me get into university', 'Needed to improve my math grades for my uni application. Wurlo got me from a C to an A in one semester. Changed my life!', true),
      ('Chloe L.', 5, 'Simple but powerful', 'No fluff, just pure learning. The interface is clean, the lessons are clear, and the results speak for themselves. Five stars!', true)
    `);
    
    console.log('✅ Added 15 new reviews successfully!');
    
    // Verify total
    const result = await pool.query('SELECT COUNT(*) as count FROM reviews');
    console.log(`📊 Total reviews in database: ${result.rows[0].count}`);
    
    // Show sample
    const sample = await pool.query('SELECT name, rating, title FROM reviews ORDER BY id DESC LIMIT 5');
    console.log('\n📝 Latest 5 reviews:');
    sample.rows.forEach(r => {
      console.log(`   ⭐ ${r.rating}/5 - ${r.name}: "${r.title}"`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding reviews:', err);
    process.exit(1);
  }
}

add15Reviews();
