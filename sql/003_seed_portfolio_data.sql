-- =============================================================================
-- Migration 003: Seed Portfolio Data (Skills, Projects, Site Profile)
-- =============================================================================

-- 1. Insert Skills
INSERT INTO skills (name, icon_url, display_order) VALUES
('HTML5', '/assets/icon/skills/html5.svg', 1),
('CSS3', '/assets/icon/skills/css.svg', 2),
('JavaScript', '/assets/icon/skills/javascript.svg', 3),
('React', '/assets/icon/skills/react.svg', 4),
('Next.js', '/assets/icon/skills/nextjs.svg', 5),
('Tailwind CSS', '/assets/icon/skills/tailwind.svg', 6),
('Git & GitHub', '/assets/icon/skills/git.svg', 7),
('TypeScript', '/assets/icon/skills/typescript.svg', 8)
ON CONFLICT DO NOTHING;

DELETE FROM skills WHERE LOWER(TRIM(name)) IN ('node', 'node.js', 'nodejs', 'express', 'express.js');

-- 2. Insert Web Projects
INSERT INTO projects (slug, title, description, category, image_url, project_type, url, display_order) VALUES
('rokad-web', 'Rokad Web', 'Rokad — a modern multi-page platform built with Next.js 14, Tailwind CSS, and Framer Motion. Features news, events, alumni, honors, blog, and fully responsive pages, now live in production.', '["Next.js","React","Tailwind"]'::jsonb, '', 'web', 'https://rokadschool.ir', 1),
('digikala', 'DigiKala', 'A responsive clone of the DigiKala e-commerce website built with HTML, CSS, and JavaScript, including product listings, navigation, and a clean shopping interface.', '["HTML","CSS","JavaScript"]'::jsonb, '/assets/previews/Digikala.webp', 'web', '../Projects/Web-Project/Digikala/index.html', 2),
('porskad', 'Porskad', 'Porskad — a dedicated form and survey management system for educational institutes. Built with React, Tailwind CSS, and Framer Motion, featuring an interactive admin dashboard, embeddable forms, and a responsive UI.', '["React","Tailwind","JavaScript"]'::jsonb, '/assets/previews/porskad.webp', 'web', 'https://porskad.vercel.app', 3),
('rokad-college', 'Rokad College', 'Rokad College — a modern online learning platform built with React 18, Tailwind CSS, and Swiper. Features hero sections, course pillars, statistics, and fully responsive pages, now live in production.', '["React","Tailwind","JavaScript"]'::jsonb, '', 'web', 'https://college.rokadschool.ir', 4),
('crypto-market', 'Crypto Market', 'A cryptocurrency market dashboard built with React, Vite and Tailwind CSS. Live CoinGecko data through a shared context, instant currency switching, dynamic coin pages with routing, and interactive price charts.', '["React","Tailwind","JavaScript"]'::jsonb, '', 'web', '../Projects/Web-Project/cryptoproject', 5),
('novabank', 'NovaBank', 'A modern banking and payments landing page built with React, Vite, and Tailwind CSS. Features a hero with layered card artwork, feature grid, billing and business sections, client logos, testimonials, and a fully responsive layout.', '["React","Tailwind"]'::jsonb, '', 'web', '../Projects/Web-Project/novabank', 6),
('ubisoft', 'Ubisoft', 'A responsive clone of the Ubisoft website built with HTML, CSS, and JavaScript, featuring a modern UI, interactive sections, and smooth user experience.', '["HTML","CSS","JavaScript"]'::jsonb, '/assets/previews/Ubisoft.webp', 'web', '../Projects/Web-Project/Ubisoft/index.html', 7),
('khodrochini-110', 'Khodrochini 110', 'A Persian WordPress site for a specialised Chinese-car repair workshop in Tehran. Custom theme with service pages, workshop gallery, FAQ, blog, and local SEO structure, all fully right-to-left.', '[]'::jsonb, '', 'web', 'https://khodrochini110.com/', 8),
('study-timer', 'Study Timer', 'A study tracker and exam countdown app built with Next.js, React, and Supabase. Features task management, study session tracking, and a clean modern interface.', '["Next.js","React","Supabase"]'::jsonb, '/assets/previews/konkortimer.webp', 'web', '../Projects/Web-Project/konkortimer-dist/', 9),
('sabzlearn', 'Sabz Learn', 'A modern online learning platform inspired by Sabz Learn, built with React and Tailwind CSS, featuring course browsing, reusable components, responsive design, and a clean user experience.', '["React","Tailwind"]'::jsonb, '/assets/previews/Sabz-Learn.webp', 'web', '../Projects/Web-Project/Sabz-Learn', 10),
('todo-app', 'Todo App', 'A task management application built with React and Tailwind CSS, allowing users to create, organize, edit, and track daily tasks through a clean and responsive interface.', '["React","Tailwind"]'::jsonb, '/assets/previews/Todo-App.webp', 'web', '../Projects/Web-Project/Todo-App/index.html', 11)
ON CONFLICT (slug) DO NOTHING;

-- 3. Insert Mini Projects
INSERT INTO projects (slug, title, description, category, image_url, project_type, url, display_order) VALUES
('calculator', 'Calculator', 'A clean, responsive calculator built with React. Features basic arithmetic operations, keyboard support, and a modern minimal UI design.', '["React"]'::jsonb, '/assets/previews/Calculator.webp', 'mini', '../Projects/Mini-Project/Calculator/index.html', 1),
('timer', 'Timer', 'A countdown and stopwatch timer with start, pause, and reset controls. Built with clean HTML, CSS, and vanilla JavaScript.', '["JavaScript","HTML","CSS"]'::jsonb, '/assets/previews/timer.webp', 'mini', '../Projects/Mini-Project/timer/index.html', 2),
('currency-converter', 'Currency Converter', 'A clean, fully offline currency converter built with React and TypeScript. Supports 20+ major world currencies plus Iranian Toman, with a searchable dropdown, manual exchange rate input, and live-as-you-type conversion.', '["React","TypeScript"]'::jsonb, '/assets/previews/currency-converter.webp', 'mini', '../Projects/Mini-Project/currency-converter/', 3),
('css-playground', 'CSS Playground', 'A collection of 31 pure CSS animations — buttons, cards, loaders, motion, text effects, and backgrounds. Copy any snippet and use it anywhere.', '["HTML","CSS","JavaScript"]'::jsonb, '/assets/previews/css-playground.webp', 'mini', '../Projects/Mini-Project/css-playground-project/', 4),
('netbridge', 'NetBridge', 'Share your phone internet to PC with the phone''s VPN applied to the shared connection — free, open source, and under your control. Features Hotspot and USB tethering modes.', '[]'::jsonb, '', 'mini', 'https://github.com/MohammadMehdiSadeghi/NetBridge', 5),
('cachecleaner', 'CacheCleaner', 'A Windows cache cleaner desktop GUI app. Scans ~490 cache locations across applications, reports sizes, and safely deletes contents while preserving crucial profiles and keys.', '[]'::jsonb, '', 'mini', 'https://github.com/MohammadMehdiSadeghi/CacheCleaner', 6),
('work-buddy-rtl', 'WorkBuddy RTL', 'A Persian font and right-to-left layer for the WorkBuddy desktop app. Injects Vazir typography, automatic per-message direction, and RTL composer alignment at runtime, while the app''s own files stay byte-for-byte untouched. Works on Windows, macOS and Linux.', '[]'::jsonb, '', 'mini', 'https://github.com/MohammadMehdiSadeghi/work-buddy-rtl', 7)
ON CONFLICT (slug) DO NOTHING;

-- 4. Insert Site Profile Setting
INSERT INTO site_settings (key, value) VALUES
('profile', '{
    "name": "Mohammadmehdi Sadeghi",
    "role": "Frontend & Full-Stack Developer",
    "bio": "Passionate developer focused on building ultra-fast, aesthetically pleasing, and secure web applications.",
    "email": "contact@mohammadmehdisadeghi.dev",
    "telegram": "https://t.me/MohammadmehdiSadeghi",
    "github": "https://github.com/MohammadmehdiSadeghi",
    "linkedin": "https://linkedin.com/in/mohammadmehdisadeghi"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
