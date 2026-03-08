/*
 * Shared helper functions for the personal blog.
 *
 * This script defines functions for fetching posts and configuration data from
 * GitHub, parsing front‑matter, rendering posts and interacting with the
 * GitHub REST API.  You can include this file in any HTML page by adding
 * `<script src="scripts/main.js"></script>`.
 */

/*
 * IMPORTANT: Replace OWNER and REPO with your own GitHub username and
 * repository name before deploying.  The BRANCH should point to the branch
 * where your posts and config live (e.g. "main").  These values are used
 * throughout the code to build GitHub API URLs.  You can also override them
 * at runtime by storing values in localStorage (see admin.html for details).
 */
// Updated with the actual repository owner and name.
const OWNER = 'spicysuiai';
const REPO = 'personal-blog';
const BRANCH = 'main';

/**
 * Helper to retrieve the active repository information.  Tries to read from
 * localStorage (allowing you to change the values in the admin page) and
 * falls back to the constants defined above.
 */
function getRepoInfo() {
  const owner = localStorage.getItem('gh_owner') || OWNER;
  const repo = localStorage.getItem('gh_repo') || REPO;
  const branch = localStorage.getItem('gh_branch') || BRANCH;
  return { owner, repo, branch };
}

/**
 * Fetch the JSON configuration for the site.  The function attempts to
 * download `config.json` from the GitHub repository first.  If that fails
 * (e.g. repository not configured yet) it falls back to loading the local
 * `config.json` file bundled with the site.  The returned promise resolves
 * with a plain object containing at least `title` and `description` fields.
 */
async function loadConfig() {
  const { owner, repo, branch } = getRepoInfo();
  // attempt to fetch remote config.json from GitHub
  if (owner && repo) {
    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/config.json?${Date.now()}`;
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        window.config = json;
        return json;
      }
    } catch (err) {
      console.warn('Failed to fetch remote config:', err);
    }
  }
  // fallback to bundled config.json
  const response = await fetch('config.json');
  const json = await response.json();
  window.config = json;
  return json;
}

/**
 * Retrieve the list of post slugs from the GitHub repository.  Each slug
 * corresponds to a Markdown file under the `posts/` directory.  Returns an
 * array of strings (without the `.md` extension).  If the repository
 * information is missing or the API call fails, the promise rejects.
 */
async function fetchPostsList() {
  const { owner, repo, branch } = getRepoInfo();
  if (!owner || !repo) {
    throw new Error('Repository information is not configured.');
  }
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/posts?ref=${branch}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch posts list.');
  }
  const files = await response.json();
  return files
    .filter((file) => file.name.toLowerCase().endsWith('.md'))
    .map((file) => file.name.replace(/\.md$/i, ''));
}

/**
 * Fetch the raw Markdown content of a post by slug.  The slug should not
 * include the `.md` extension.  Returns a string containing the full
 * Markdown file.  Throws an error if the file cannot be fetched.
 */
async function fetchPostContent(slug) {
  const { owner, repo, branch } = getRepoInfo();
  if (!owner || !repo) {
    throw new Error('Repository information is not configured.');
  }
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/posts/${encodeURIComponent(slug)}.md?${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch post content');
  }
  return await response.text();
}

/**
 * Parse a Markdown string containing YAML front‑matter.  Returns an object
 * with two properties:
 *  - `data`: a plain object mapping front‑matter keys to values
 *  - `content`: the Markdown content with the front‑matter removed
 */
function parseFrontMatter(markdown) {
  if (!markdown.startsWith('---')) {
    return { data: {}, content: markdown };
  }
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) {
    return { data: {}, content: markdown };
  }
  const fm = markdown.slice(3, end).trim();
  const rest = markdown.slice(end + 4).trim();
  const data = {};
  fm.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      data[key] = value;
    }
  });
  return { data, content: rest };
}

/**
 * Render the list of posts on the index page.  This function fetches all
 * posts from the repository, sorts them by date (descending) and injects
 * HTML into the element with id `posts`.  It gracefully handles errors by
 * showing a message instead of the list.
 */
async function renderPostsList() {
  const container = document.getElementById('posts');
  if (!container) return;
  container.innerHTML = '<p>加载中…</p>';
  try {
    const slugs = await fetchPostsList();
    const posts = [];
    for (const slug of slugs) {
      try {
        const raw = await fetchPostContent(slug);
        const { data, content } = parseFrontMatter(raw);
        let excerpt = '';
        if (data.excerpt) {
          excerpt = data.excerpt;
        } else {
          const firstPara = content.trim().split(/\n{2,}/)[0];
          // remove markdown syntax for the excerpt preview
          excerpt = firstPara.replace(/[#*_`>\[\]()-]/g, '').slice(0, 140);
          if (excerpt.length === 140) excerpt += '…';
        }
        posts.push({
          slug,
          title: data.title || slug,
          date: data.date || '',
          excerpt,
        });
      } catch (err) {
        console.warn('Failed to fetch post', slug, err);
      }
    }
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (posts.length === 0) {
      container.innerHTML = '<p>没有文章。请通过管理员界面发布一篇新文章。</p>';
      return;
    }
    container.innerHTML = '';
    posts.forEach((post) => {
      const div = document.createElement('div');
      div.className = 'post-item';
      div.innerHTML =
        `<h2><a href="post.html?slug=${encodeURIComponent(post.slug)}">${post.title}</a></h2>` +
        `<div class="post-meta">${post.date ? new Date(post.date).toLocaleDateString() : ''}</div>` +
        `<div class="post-excerpt">${post.excerpt}</div>`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p>无法获取文章列表，请检查配置或网络连接。</p>';
  }
}

/**
 * Render a single post on the `post.html` page.  The function expects the
 * page to have elements with ids `post-title`, `post-date` and
 * `post-content`.  It reads the `slug` query parameter from the URL,
 * fetches the corresponding Markdown file, parses front‑matter and
 * converts the Markdown into HTML using the global `marked` library (which
 * must be included on the page).  Errors are displayed in place of the
 * content.
 */
async function renderPostPage() {
  const titleElem = document.getElementById('post-title');
  const dateElem = document.getElementById('post-date');
  const contentElem = document.getElementById('post-content');
  if (!titleElem || !contentElem) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) {
    titleElem.innerText = '未指定文章';
    contentElem.innerHTML = '<p>未找到文章标识符。</p>';
    return;
  }
  try {
    const raw = await fetchPostContent(slug);
    const { data, content } = parseFrontMatter(raw);
    document.title = data.title || slug;
    titleElem.innerText = data.title || slug;
    dateElem.innerText = data.date ? new Date(data.date).toLocaleString() : '';
    // Use the global `marked` to render Markdown -> HTML
    const html = typeof marked !== 'undefined' ? marked.parse(content) : content;
    contentElem.innerHTML = html;
  } catch (err) {
    console.error(err);
    titleElem.innerText = '文章加载失败';
    contentElem.innerHTML = '<p>无法加载此文章。请检查链接或稍后再试。</p>';
  }
}

/* ==================== GitHub write operations ==================== */

/**
 * Encode a Unicode string to base64.  Browsers provide `btoa` but it works
 * only on ASCII.  This helper encodes the string in UTF‑8 before calling
 * `btoa` so that non‑ASCII characters are handled correctly.
 */
function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Get the SHA of an existing file in the repository.  This is required for
 * updating files via the GitHub API.  Returns `null` if the file does not
 * exist.
 */
async function getFileSha(token, path) {
  const { owner, repo, branch } = getRepoInfo();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha;
}

/**
 * Commit a file (create or update) to the repository using the GitHub API.
 * You must pass a personal access token with `repo` scope.  The function
 * automatically includes the correct SHA when updating an existing file.
 *
 * @param {string} token   Your GitHub personal access token.
 * @param {string} path    Path to the file in the repo (e.g. 'config.json').
 * @param {string} content The new file contents (plain text).
 * @param {string} message Commit message.
 * @returns {Promise<boolean>} whether the commit succeeded.
 */
async function commitFile(token, path, content, message) {
  const { owner, repo, branch } = getRepoInfo();
  if (!owner || !repo) throw new Error('Repository information is not configured.');
  const sha = await getFileSha(token, path);
  const body = {
    message,
    content: encodeBase64(content),
    branch,
  };
  if (sha) body.sha = sha;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/**
 * Save the configuration file (`config.json`) based on the values of the
 * provided inputs.  Reads the GitHub token and repository info from
 * localStorage.  Displays messages on success or failure.
 */
async function saveConfigFromForm(titleInput, descInput, statusElem) {
  const token = localStorage.getItem('gh_token');
  if (!token) {
    alert('请先在凭证设置中输入 GitHub 访问令牌。');
    return;
  }
  const configObj = {
    title: titleInput.value.trim(),
    description: descInput.value.trim(),
    postsPerPage: 5,
  };
  try {
    const success = await commitFile(token, 'config.json', JSON.stringify(configObj, null, 2), 'Update config');
    statusElem.textContent = success ? '配置已保存。' : '保存配置失败。';
    statusElem.style.color = success ? 'green' : 'red';
  } catch (err) {
    console.error(err);
    statusElem.textContent = '保存配置失败。';
    statusElem.style.color = 'red';
  }
}

/**
 * Publish a new post to the repository.  Constructs a Markdown file with
 * basic front‑matter and commits it to `posts/<slug>.md`.  Uses values
 * from the provided inputs.  Assumes that repository info and token are
 * stored in localStorage.
 */
async function publishNewPost(titleInput, authorInput, slugInput, contentInput, statusElem) {
  const token = localStorage.getItem('gh_token');
  if (!token) {
    alert('请先在凭证设置中输入 GitHub 访问令牌。');
    return;
  }
  let slug = slugInput.value.trim();
  if (!slug) {
    // generate slug from title
    slug = titleInput.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[\\/:\(\)\*\?"<>|]/g, '');
    slugInput.value = slug;
  }
  const md =
    `---\n` +
    `title: ${titleInput.value.trim()}\n` +
    `date: ${new Date().toISOString()}\n` +
    `author: ${authorInput.value.trim()}\n` +
    `---\n\n` +
    `${contentInput.value.trim()}\n`;
  try {
    const path = `posts/${slug}.md`;
    const success = await commitFile(token, path, md, `Add new post: ${slug}`);
    statusElem.textContent = success ? '文章已发布。' : '发布失败。';
    statusElem.style.color = success ? 'green' : 'red';
    if (success) {
      // clear fields after successful publish
      titleInput.value = '';
      authorInput.value = '';
      slugInput.value = '';
      contentInput.value = '';
    }
  } catch (err) {
    console.error(err);
    statusElem.textContent = '发布失败。';
    statusElem.style.color = 'red';
  }
}