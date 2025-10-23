-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200) NOT NULL,
  review_text TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert test reviews
INSERT INTO reviews (name, rating, title, review_text, is_verified) VALUES
('Sarah M.', 5, 'Game changer for my math skills', 'I always struggled with math and thought I was just "bad at it". Wurlo changed everything. The placement test showed exactly where I needed help, and the lessons adapted perfectly to my level. Now I''m confident handling numbers at work!', true),
('John K.', 5, 'Perfect for busy professionals', 'As someone working full-time, I don''t have hours to spend on courses. Wurlo''s 15-minute lessons fit perfectly into my schedule. The adaptive approach means I''m not wasting time on stuff I already know. Highly recommend!', true),
('Emma R.', 5, 'Finally passed my certification exam', 'I needed to pass a math test for my nursing program and was dreading it. Wurlo''s goal-focused approach meant every lesson was directly relevant to what I needed. Passed on my first try! Worth every penny.', true),
('Michael T.', 5, 'Best investment in my career', 'I was missing out on data analyst roles because of weak math skills. After using Wurlo for 3 weeks, I felt confident enough to apply. Just got my dream job! The lifetime access for £19 is an absolute steal.', true),
('Lisa P.', 5, 'No more wasted time', 'I tried Khan Academy and YouTube but got lost in irrelevant content. Wurlo is different - it only teaches what I need to reach my goal. The AI-generated podcasts are perfect for my commute. Love it!', true),
('David H.', 5, 'Actually enjoyable to learn', 'I''m 48 and haven''t done math in decades. Was nervous, but Wurlo makes it so easy to understand. The real-world examples make sense, and I can see my progress. Wish this existed when I was in school!', true);
