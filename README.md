# Iron Log

A mobile-first gym workout tracker. One static file, no build step, no accounts.

## Features
Workout logging (sets, reps, weight, warm-up/drop sets, rest timer, previous performance), exercise library with custom exercises, templates, history, volume and estimated 1RM (Epley) analytics, personal records, lb/kg, JSON export and restore.

## Publish with GitHub Pages
1. Put `index.html` in the root of a public repository.
2. Repository **Settings > Pages**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Open `https://YOUR-USERNAME.github.io/REPO-NAME/` after a minute.

## Data
Everything is stored in the browser's `localStorage` on each device. Nothing is sent to a server. Move data between devices with **Settings > Export** and **Restore from backup**. Clearing site data erases it.

## Volume rules
Volume = weight x reps for completed normal and drop sets. Warm-up and unchecked sets are excluded. For bodyweight exercises the weight field is optional added weight (bodyweight-only sets add 0 volume). Weights are stored in kg and converted for display. Weeks start Monday, local time.
