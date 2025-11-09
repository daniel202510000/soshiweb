// Datos iniciales y utilidades
const STORAGE_PRODUCTS = 'suhsiii_products';
const STORAGE_CART = 'suhsiii_cart';

const sample = [
	{ id: genId(), name: 'California Roll', desc: 'Surimi, aguacate y pepino.', price: 6.5, img: 'https://i.imgur.com/1bX5QH6.jpg' },
	{ id: genId(), name: 'Sake Nigiri', desc: 'Salmón fresco sobre arroz.', price: 3.5, img: 'https://i.imgur.com/Lq3bQ8R.jpg' },
	{ id: genId(), name: 'Spicy Tuna Roll', desc: 'Atún picante con toque de sésamo.', price: 7.2, img: 'https://i.imgur.com/3Q2Z8bG.jpg' },
];

function genId(){ return 'p_' + Math.random().toString(36).slice(2,9); }

function loadProducts(){
	const raw = localStorage.getItem(STORAGE_PRODUCTS);
	if(!raw){ localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(sample)); return sample.slice(); }
	return JSON.parse(raw);
}
function saveProducts(list){ localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(list)); }

function loadCart(){ return JSON.parse(localStorage.getItem(STORAGE_CART) || '[]'); }
function saveCart(cart){ localStorage.setItem(STORAGE_CART, JSON.stringify(cart)); }

let products = loadProducts();
let cart = loadCart();

const el = {
	products: document.getElementById('products'),
	search: document.getElementById('search'),
	cartToggle: document.getElementById('toggle-cart'),
	cartElem: document.getElementById('cart'),
	cartItems: document.getElementById('cart-items'),
	cartCount: document.getElementById('cart-count'),
	cartTotal: document.getElementById('cart-total'),
	clearCart: document.getElementById('clear-cart'),
	checkout: document.getElementById('checkout')
};

// Render
function renderProducts(filter = '') {
	el.products.innerHTML = '';
	const q = filter.trim().toLowerCase();
	products.filter(p => !q || (p.name + ' ' + (p.desc||'')).toLowerCase().includes(q))
		.forEach(p => {
			const card = document.createElement('div'); card.className = 'card';
			card.innerHTML = `
				<img src="${p.img || 'https://i.imgur.com/8Km9tLL.png'}" alt="${escapeHtml(p.name)}" />
				<div class="card-body">
					<div class="card-title">
						<h3>${escapeHtml(p.name)}</h3>
						<strong>${p.price.toFixed(2)} €</strong>
					</div>
					<p>${escapeHtml(p.desc || '')}</p>
					<div class="card-actions">
						<button class="add-btn" data-id="${p.id}">Agregar</button>
					</div>
				</div>
			`;
			el.products.appendChild(card);
		});
	// attach add handlers
	document.querySelectorAll('.add-btn').forEach(b => b.onclick = () => addToCart(b.dataset.id));
}

function renderCart(){
	el.cartItems.innerHTML = '';
	if(cart.length === 0){
		el.cartItems.innerHTML = '<div style="color:#6b7280">El carrito está vacío.</div>';
		el.cartCount.textContent = '0';
		el.cartTotal.textContent = '0.00';
		return;
	}
	let total = 0;
	cart.forEach(item => {
		const prod = products.find(p => p.id === item.id);
		if(!prod) return;
		total += prod.price * item.qty;
		const div = document.createElement('div'); div.className = 'cart-item';
		div.innerHTML = `
			<div class="meta">
				<strong>${escapeHtml(prod.name)}</strong>
				<div style="color:#6b7280;font-size:13px">${prod.price.toFixed(2)} €</div>
			</div>
			<div style="text-align:right">
				<div class="qty-controls">
					<button data-action="dec" data-id="${item.id}">-</button>
					<span>${item.qty}</span>
					<button data-action="inc" data-id="${item.id}">+</button>
				</div>
				<div style="margin-top:6px">
					<button data-action="remove" data-id="${item.id}" class="secondary">Eliminar</button>
				</div>
			</div>
		`;
		el.cartItems.appendChild(div);
	});
	el.cartCount.textContent = cart.reduce((s,i)=>s+i.qty,0);
	el.cartTotal.textContent = total.toFixed(2);

	// handlers
	el.cartItems.querySelectorAll('button').forEach(btn => {
		btn.onclick = () => {
			const id = btn.dataset.id;
			const action = btn.dataset.action;
			if(action === 'inc') changeQty(id, 1);
			if(action === 'dec') changeQty(id, -1);
			if(action === 'remove') removeFromCart(id);
		};
	});
}

function addToCart(id){
	const idx = cart.findIndex(i => i.id === id);
	if(idx >= 0) cart[idx].qty++;
	else cart.push({ id, qty:1 });
	saveCart(cart);
	renderCart();
}

function changeQty(id, delta){
	const it = cart.find(i => i.id === id);
	if(!it) return;
	it.qty += delta;
	if(it.qty <= 0) cart = cart.filter(i => i.id !== id);
	saveCart(cart);
	renderCart();
}
function removeFromCart(id){
	cart = cart.filter(i => i.id !== id);
	saveCart(cart);
	renderCart();
}

// Buscar
el.search.addEventListener('input', ev => renderProducts(ev.target.value));

// Cart toggle / actions
el.cartToggle.onclick = () => {
	el.cartElem.classList.toggle('open');
	el.cartElem.scrollIntoView({behavior:'smooth'});
};
el.clearCart.onclick = () => { if(confirm('Vaciar carrito?')){ cart = []; saveCart(cart); renderCart(); } };
el.checkout.onclick = () => { if(cart.length===0) return alert('Carrito vacío.'); alert('Simulación de pago — total: ' + el.cartTotal.textContent + ' €'); cart=[]; saveCart(cart); renderCart(); };

// Helpers
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

// Inicializar
renderProducts();
renderCart();
