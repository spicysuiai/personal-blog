# Personal Blog Web Site

This repository contains the source code for a completely static personal blog.  The
project is designed to be deployed on platforms such as Vercel or GitHub Pages
with **no build step**; everything is pure HTML, CSS and JavaScript.  It uses
the [GitHub REST API](https://docs.github.com/en/rest) to read and write
content stored in this repository.  Posts live in the `posts/` folder and
configuration (site title, description, etc.) lives in `config.json` in the
root of the repository.  Because the content and configuration are fetched
directly from GitHub at runtime, you **do not need to redeploy** the site when
adding a new post or updating the settings – simply commit your changes and
they will show up immediately.

## How it works

* The blog front‑page (`index.html`) fetches the latest `config.json` and the
  list of posts via the GitHub API.  For each post it downloads the raw
  Markdown content from the `posts/` directory in the repository, parses the
  [front‑matter metadata](https://jekyllrb.com/docs/front-matter/) and renders
  the Markdown to HTML on the client using the [`marked` library](https://marked.js.org/).

* Individual articles are rendered by `post.html`.  It reads the `slug`
  parameter from the query‑string, fetches the corresponding Markdown file
  from GitHub and displays it.  If the post does not exist an error message
  is shown.

* The administration page (`admin.html`) allows you to adjust site settings
  (title, description) and create new posts **without writing any code**.  It
  uses a GitHub personal access token (PAT) provided by you to commit
  changes back into this repository via the GitHub API.  None of these
  credentials are stored on the server – they live only in your browser’s
  localStorage.

## Initial setup

1. Create a new GitHub repository and push this code into it.  Make sure
   there is a `posts/` folder (you can keep it empty).  The repository must
   be **public** for unauthenticated GitHub API requests to work, or you
   need to set the `GH_TOKEN` environment variable in `admin.html` if your
   repository is private.

2. Open `scripts/main.js` and replace the `OWNER` and `REPO` constants with
   your GitHub username and repository name.  These constants are used by
   the front‑end to fetch posts and configuration.  You can also update the
   default `BRANCH` if you use something other than `main`.

3. Optionally update `config.json` with your blog’s title and description.
   You can also update these values later via the administration page.

4. Deploy the site using Vercel or any other static hosting provider.  On
   Vercel, choose the "Static" framework preset – there is no build step.

5. Navigate to `/admin.html` on your deployed site, enter your GitHub
   personal access token (with the `repo` scope), fill in your repository
   details and click **Save Settings**.  You can now publish posts from the
   browser.

## Security considerations

All administration takes place client‑side.  When you enter your personal
access token the site stores it in `localStorage` and sends it directly to
GitHub.  The token never leaves your browser except for requests to GitHub.
However, keep in mind that anyone with access to your browser can read this
token from storage.  If you log in from a shared computer, remember to
clear your settings afterwards.

## License

This project is released under the MIT License.  See the `LICENSE` file for
details.