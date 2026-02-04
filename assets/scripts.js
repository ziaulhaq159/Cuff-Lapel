// Minimal site script to power product listing, product detail, cart (localStorage), search, filters and pagination.
window.App = (function () {
  const CART_KEY = 'cuff_cart_v1';

  function fetchJSON(path){ return fetch(path).then(r => r.json()); }

  /* CART helpers */
  function getCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e){ return []; } }
  function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  function addToCart(item){ const cart = getCart(); const found = cart.find(i => i.id === item.id); if(found){ found.qty += item.qty; } else { cart.push(item); } saveCart(cart); }
  function updateQty(id, qty){ let cart = getCart(); cart = cart.map(i => i.id === id ? {...i, qty: Number(qty)} : i).filter(i => i.qty > 0); saveCart(cart); }
  function removeFromCart(id){ let cart = getCart().filter(i => i.id !== id); saveCart(cart); }
  function clearCart(){ localStorage.removeItem(CART_KEY); }

  function cartCount(){ const c = getCart().reduce((s,i)=>s + (i.qty||0), 0); return c; }

  /* --- Product grid with search/filters/pagination --- */
  async function initProductGrid(targetSelector, productsPath, opts = {}) {
    const el = document.querySelector(targetSelector);
    if(!el) return;
    const data = await fetchJSON(productsPath);

    // build category filter
    const categories = Array.from(new Set(data.map(p => p.category))).sort();
    if(opts.categorySelector){
      const catEl = document.querySelector(opts.categorySelector);
      if(catEl){
        catEl.innerHTML = '<option value="">All categories</option>' + categories.map(c=>`<option value="${c}">${c}</option>`).join('');
      }
    }

    // paging state
    let page = 1;
    const pageSize = opts.pageSize || 8;

    // helpers
    function applyFilters(items){
      const search = (document.querySelector(opts.searchSelector)?.value || '').trim().toLowerCase();
      const cat = document.querySelector(opts.categorySelector)?.value || '';
      let out = items.filter(p => {
        if(cat && p.category !== cat) return false;
        if(search){
          return p.name.toLowerCase().includes(search) || p.excerpt.toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search);
        }
        return true;
      });
      const sort = document.querySelector(opts.sortSelector)?.value || 'featured';
      if(sort === 'price-asc') out = out.sort((a,b) => a.price - b.price);
      if(sort === 'price-desc') out = out.sort((a,b) => b.price - a.price);
      return out;
    }

    function renderPage(){
      const filtered = applyFilters(data);
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if(page > totalPages) page = totalPages;
      const start = (page - 1) * pageSize;
      const pageItems = filtered.slice(start, start + pageSize);
      el.innerHTML = pageItems.map(p => productCardHTML(p)).join('');
      attachAddHandlers(data);
      document.querySelector(opts.pageInfo || '#pageInfo').textContent = `Page ${page} of ${totalPages}`;
      document.querySelector(opts.prevBtn || '#prevPage').disabled = page <= 1;
      document.querySelector(opts.nextBtn || '#nextPage').disabled = page >= totalPages;
    }

    // events
    if(opts.searchSelector) document.querySelector(opts.searchSelector).addEventListener('input', () => { page = 1; renderPage(); });
    if(opts.categorySelector) document.querySelector(opts.categorySelector).addEventListener('change', () => { page = 1; renderPage(); });
    if(opts.sortSelector) document.querySelector(opts.sortSelector).addEventListener('change', () => { page = 1; renderPage(); });
    if(opts.prevBtn) document.querySelector(opts.prevBtn).addEventListener('click', () => { page = Math.max(1, page - 1); renderPage(); });
    if(opts.nextBtn) document.querySelector(opts.nextBtn).addEventListener('click', () => { page++; renderPage(); });

    // initial render
    renderPage();
  }

  function productCardHTML(p){
    return `
      <article class="product-card">
        <a href="products/${encodeURIComponent(p.id)}.html" aria-label="${p.name}">
          <div class="media"><img loading="lazy" src="${p.image}" alt="${p.name}"></div>
        </a>
        <div class="info">
          <h4><a href="products/${encodeURIComponent(p.id)}.html">${p.name}</a></h4>
          <p class="muted">${p.excerpt}</p>
          <div class="price">₹ ${p.price}</div>
          <div style="margin-top:8px;">
            <button class="btn ghost js-add" data-id="${p.id}">Add</button>
            <a class="btn primary" href="products/${encodeURIComponent(p.id)}.html" style="margin-left:8px">View</a>
          </div>
        </div>
      </article>
    `;
  }

  function attachAddHandlers(data){
    document.querySelectorAll('.js-add').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const id = btn.dataset.id;
        const p = data.find(x=>x.id===id);
        addToCart({ id: p.id, name: p.name, price: p.price, qty: 1 });
        updateCartCount();
        btn.textContent = 'Added';
        setTimeout(()=>btn.textContent='Add', 900);
      });
    });
  }

  /* Product page rendering by query (fallback) */
  async function renderProductFromQuery(productsPath, targetSelector){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const target = document.querySelector(targetSelector);
    if(!id || !target){ target && (target.innerHTML = '<p>No product selected.</p>'); return; }
    const data = await fetchJSON(productsPath);
    const p = data.find(x=>x.id === id);
    if(!p){ target.innerHTML = '<p>Product not found.</p>'; return; }

    target.innerHTML = `
      <div>
        <div class="media-large"><img src="${p.image}" alt="${p.name}"></div>
        <div class="meta">
          <h1 style="margin:0.6rem 0 0.4rem">${p.name}</h1>
          <div class="muted">${p.category}</div>
          <div style="margin-top:0.6rem" class="price">₹ ${p.price}</div>
          <p style="margin-top:0.8rem">${p.description}</p>
          <div class="qty">
            <label>Qty
              <input type="number" id="qtyField" value="1" min="1">
            </label>
            <button class="btn primary" id="addToCartBtn">Add to cart</button>
            <a class="btn ghost" href="checkout.html" style="margin-left:8px">Checkout</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('addToCartBtn').addEventListener('click', () => {
      const qty = Number(document.getElementById('qtyField').value || 1);
      addToCart({ id: p.id, name: p.name, price: p.price, qty: qty });
      updateCartCount();
      alert(`${p.name} added to cart (${qty})`);
    });
  }

  async function populateRelated(productsPath, targetSelector, limit = 4){
    const el = document.querySelector(targetSelector);
    if(!el) return;
    const data = await fetchJSON(productsPath);
    el.innerHTML = data.slice(0, limit).map(p => `
      <a class="product-card" href="products/${encodeURIComponent(p.id)}.html" style="display:block">
        <div class="media" style="height:80px"><img src="${p.image}" alt="${p.name}"></div>
        <div class="info"><h4 style="font-size:0.9rem;margin:6px 0 0">${p.name}</h4></div>
      </a>
    `).join('');
  }

  /* CART RENDER */
  async function renderCart(cartContainerSelector, summarySelector){
    const container = document.querySelector(cartContainerSelector);
    const summary = document.querySelector(summarySelector);
    const data = await fetchJSON('data/products.json');
    const cart = getCart();
    if(!container) return;
    if(cart.length === 0){
      container.innerHTML = '<p class="muted">Your cart is empty.</p>';
      if(summary) summary.innerHTML = '';
      return;
    }

    container.innerHTML = cart.map(item => {
      const prod = data.find(p => p.id === item.id) || {};
      return `
        <div class="card" style="display:flex;gap:0.75rem;align-items:center;margin-bottom:0.8rem">
          <img src="${prod.image}" alt="${item.name}" style="width:96px;height:64px;object-fit:cover;border-radius:6px">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${item.name}</strong>
              <button data-id="${item.id}" class="btn ghost js-remove">Remove</button>
            </div>
            <div class="muted">₹ ${item.price} each</div>
            <div style="margin-top:6px">
              Qty <input class="qty-input" data-id="${item.id}" type="number" min="1" value="${item.qty}" style="width:64px;padding:6px;border-radius:6px;border:1px solid #e6eefc">
            </div>
          </div>
        </div>
      `;
    }).join('');

    const subtotal = cart.reduce((s,i)=> s + (i.price * i.qty), 0);
    const shipping = subtotal > 1000 ? 0 : 49;
    const total = subtotal + shipping;
    if(summary) summary.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><strong>₹ ${subtotal.toFixed(2)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span>Shipping</span><span>₹ ${shipping.toFixed(2)}</span></div>
        <hr style="margin:8px 0;border:none;border-top:1px solid #eef2ff">
        <div style="display:flex;justify-content:space-between"><strong>Total</strong><strong>₹ ${total.toFixed(2)}</strong></div>
      </div>
    `;

    container.querySelectorAll('.js-remove').forEach(btn=>{
      btn.addEventListener('click', () => {
        removeFromCart(btn.dataset.id);
        renderCart(cartContainerSelector, summarySelector);
        updateCartCount();
      });
    });
    container.querySelectorAll('.qty-input').forEach(inp=>{
      inp.addEventListener('change', () => {
        const id = inp.dataset.id;
        const qty = Number(inp.value || 1);
        updateQty(id, qty);
        renderCart(cartContainerSelector, summarySelector);
        updateCartCount();
      });
    });
  }

  function updateCartCount(selector){
    const count = cartCount();
    if(selector){
      const el = document.querySelector(selector);
      if(el) el.textContent = String(count);
    } else {
      const els = document.querySelectorAll('#cart-count');
      els.forEach(e => e.textContent = String(count));
    }
  }

  return {
    initProductGrid,
    renderProductFromQuery,
    populateRelated,
    renderCart,
    updateCartCount,
    addToCart: (item) => { addToCart(item); updateCartCount(); },
    clearCart,
    getCart,
    updateQty,
    removeFromCart
  };
})();