// Datos iniciales y utilidades
const STORAGE_PRODUCTS = 'suhsiii_products';
const STORAGE_CART = 'suhsiii_cart';

// sample ahora incluye sales y salesHistory
const sample = [
	{ id: genId(), name: 'California Roll', desc: 'Surimi, aguacate y pepino.', price: 6.5, img: 'https://i.imgur.com/1bX5QH6.jpg', sales: 0, salesHistory: [] },
	{ id: genId(), name: 'Sake Nigiri', desc: 'Salmón fresco sobre arroz.', price: 3.5, img: 'https://i.imgur.com/Lq3bQ8R.jpg', sales: 0, salesHistory: [] },
	{ id: genId(), name: 'Spicy Tuna Roll', desc: 'Atún picante con toque de sésamo.', price: 7.2, img: 'https://i.imgur.com/3Q2Z8bG.jpg', sales: 0, salesHistory: [] },
];

function genId(){ return 'p_' + Math.random().toString(36).slice(2,9); }

// loadProducts: asegurar sales y salesHistory en cada producto
function loadProducts(){
	const raw = localStorage.getItem(STORAGE_PRODUCTS);
	let list;
	if(!raw){
		localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(sample));
		list = sample.slice();
	} else {
		list = JSON.parse(raw);
		// normalizar para asegurar sales y salesHistory
		let updated = false;
		list.forEach(p => { 
			if(typeof p.sales !== 'number'){ p.sales = 0; updated = true; } 
			if(!Array.isArray(p.salesHistory)){ p.salesHistory = []; updated = true; }
		});
		if(updated) saveProducts(list);
	}
	return list;
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
			card.dataset.productId = p.id;
			card.innerHTML = `
				<img src="${p.img || 'https://i.imgur.com/8Km9tLL.png'}" alt="${escapeHtml(p.name)}" />
				<div class="card-body">
					<div class="card-title">
						<h3>${escapeHtml(p.name)}</h3>
						<strong>${formatCurrency(p.price)}</strong>
					</div>
					<p>${escapeHtml(p.desc || '')}</p>
					<div class="card-actions">
						<button class="add-btn" data-id="${p.id}">Agregar</button>
					</div>
				</div>
			`;
			// abrir modal al clicar la tarjeta (pero evitar duplicado si se clicó el botón)
			card.onclick = (ev) => {
				if(ev.target && ev.target.classList && ev.target.classList.contains('add-btn')) return;
				openProductModal(p.id);
			};
			el.products.appendChild(card);
		});
	// attach add handlers (abrir modal en vez de añadir directo)
	document.querySelectorAll('.add-btn').forEach(b => b.onclick = (e) => {
		const id = e.currentTarget.dataset.id;
		openProductModal(id);
	});
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
				<div style="color:#6b7280;font-size:13px">${formatCurrency(prod.price)} ${item.option ? ' • ' + escapeHtml(item.option) : ''}</div>
			</div>
			<div style="text-align:right">
				<div class="qty-controls">
					<button data-action="dec" data-id="${item.id}" data-opt="${encodeURIComponent(item.option || '')}">-</button>
					<span>${item.qty}</span>
					<button data-action="inc" data-id="${item.id}" data-opt="${encodeURIComponent(item.option || '')}">+</button>
				</div>
				<div style="margin-top:6px">
					<button data-action="remove" data-id="${item.id}" data-opt="${encodeURIComponent(item.option || '')}" class="secondary">Eliminar</button>
				</div>
			</div>
		`;
		el.cartItems.appendChild(div);
	});
	el.cartCount.textContent = cart.reduce((s,i)=>s+i.qty,0);
	// { changed code }: mostrar total en MXN con formato
	el.cartTotal.textContent = formatCurrency(total);

	// handlers (tener en cuenta data-opt)
	el.cartItems.querySelectorAll('button').forEach(btn => {
		btn.onclick = () => {
			const id = btn.dataset.id;
			const opt = decodeURIComponent(btn.dataset.opt || '');
			const action = btn.dataset.action;
			if(action === 'inc') changeQty(id, opt, 1);
			if(action === 'dec') changeQty(id, opt, -1);
			if(action === 'remove') removeFromCart(id, opt);
		};
	});
}

// { added code }: registrar ventas en salesHistory y actualizar totals
function recordSales(cartItems){
	const now = Date.now();
	cartItems.forEach(it => {
		const prod = products.find(p => p.id === it.id);
		if(!prod) return;
		prod.salesHistory = prod.salesHistory || [];
		prod.salesHistory.push({ qty: it.qty, ts: now });
		// mantener tope para evitar crecimiento indefinido
		if(prod.salesHistory.length > 500) prod.salesHistory.splice(0, prod.salesHistory.length - 500);
		prod.sales = (prod.sales || 0) + it.qty;
	});
	// persistir cambios en productos
	saveProducts(products);
}

function addToCart(id, option = '', qty = 1){
	qty = Number(qty) || 1;
	const idx = cart.findIndex(i => i.id === id && (i.option || '') === (option || ''));
	if(idx >= 0) cart[idx].qty += qty;
	else cart.push({ id, option: option || '', qty });
	saveCart(cart);
	renderCart();
}

function changeQty(id, option, delta){
	const it = cart.find(i => i.id === id && (i.option || '') === (option || ''));
	if(!it) return;
	it.qty += delta;
	if(it.qty <= 0) cart = cart.filter(i => !(i.id === id && (i.option||'') === (option||'')));
	saveCart(cart);
	renderCart();
}
function removeFromCart(id, option){
	cart = cart.filter(i => !(i.id === id && (i.option||'') === (option||'')));
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


// --- Address handling (new) ---
const ADDR_KEY = 'suhsiii_address';
const addrTextEl = document.getElementById('addressText');
const editAddrBtn = document.getElementById('editAddressBtn');
const addrModal = document.getElementById('addrModal');
const addrInput = document.getElementById('addrInput');
const detectBtn = document.getElementById('detectBtn');
const saveAddrBtn = document.getElementById('saveAddrBtn');
const closeAddrBtn = document.getElementById('closeAddrBtn');
const addrStatus = document.getElementById('addrStatus');

function loadAddress(){
	try{
		return JSON.parse(localStorage.getItem(ADDR_KEY) || 'null');
	}catch(e){ return null; }
}
function saveAddress(addrObj){
	localStorage.setItem(ADDR_KEY, JSON.stringify(addrObj));
	setAddressToUI(addrObj);
}
function setAddressToUI(addrObj){
	if(!addrObj || !addrObj.display){
		addrTextEl.textContent = 'Añadir dirección';
		return;
	}
	addrTextEl.textContent = addrObj.display;
}

// show modal
editAddrBtn.addEventListener('click', () => {
	const cur = loadAddress();
	addrInput.value = cur && cur.display ? cur.display : '';
	addrStatus.textContent = '';
	addrModal.classList.add('open'); addrModal.setAttribute('aria-hidden','false');
	addrInput.focus();
});
closeAddrBtn.addEventListener('click', () => {
	addrModal.classList.remove('open'); addrModal.setAttribute('aria-hidden','true');
});

// save manual
saveAddrBtn.addEventListener('click', () => {
	const v = addrInput.value.trim();
	if(!v){ addrStatus.textContent = 'Introduce una dirección válida.'; return; }
	saveAddress({ display: v, lat:null, lon:null, source:'manual' });
	addrModal.classList.remove('open'); addrModal.setAttribute('aria-hidden','true');
});

// detect location
detectBtn.addEventListener('click', async () => {
	addrStatus.textContent = 'Detectando ubicación...';
	if(!navigator.geolocation){ addrStatus.textContent = 'Geolocalización no soportada por este navegador.'; return; }
	navigator.geolocation.getCurrentPosition(async pos => {
		const lat = pos.coords.latitude, lon = pos.coords.longitude;
		addrStatus.textContent = 'Obteniendo dirección...';
		const display = await reverseGeocode(lat, lon);
		if(display){
			saveAddress({ display, lat, lon, source:'geolocation' });
			addrModal.classList.remove('open'); addrModal.setAttribute('aria-hidden','true');
		}else{
			addrStatus.textContent = 'No se pudo determinar la dirección desde las coordenadas.';
		}
	}, err => {
		addrStatus.textContent = 'Error obteniendo ubicación: ' + (err.message || err.code);
	}, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
});

// reverse geocode using Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lon){
	try{
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
		const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
		if(!res.ok) return null;
		const data = await res.json();
		return data.display_name || null;
	}catch(e){
		return null;
	}
}

// initialize address on load
setTimeout(() => {
	try{
		const a = loadAddress();
		setAddressToUI(a);
	}catch(e){}
}, 50);

// --- Top sold handling (new) ---
function scoreProductByRecency(prod, halfLifeDays = 30){
	// decay exponencial: weight = exp(-ageDays / halfLifeDays)
	if(!prod || !Array.isArray(prod.salesHistory) || prod.salesHistory.length === 0) return 0;
	const now = Date.now();
	const msPerDay = 1000 * 60 * 60 * 24;
	// sum(qty * weight)
	let score = 0;
	for(const ev of prod.salesHistory){
		const ageDays = Math.max(0, (now - ev.ts) / msPerDay);
		const weight = Math.exp(- ageDays / halfLifeDays);
		score += (ev.qty || 0) * weight;
	}
	return score;
}

function getTopSold(n = 3){
	const copy = products.slice();
	copy.forEach(p => {
		p._topScore = scoreProductByRecency(p, 30); // guarda temporalmente la puntuación
	});
	copy.sort((a,b) => {
		// ordenar por score, si empate usar sales total
		if(b._topScore === a._topScore) return (b.sales || 0) - (a.sales || 0);
		return b._topScore - a._topScore;
	});
	return copy.slice(0, n);
}

function renderTopProducts(){
	const elTop = document.getElementById('topProducts');
	if(!elTop) return;
	elTop.innerHTML = '';
	// si ninguna venta > 0 en history, mostrar mensaje
	const anySales = products.some(p => (Array.isArray(p.salesHistory) && p.salesHistory.length > 0) || (p.sales && p.sales > 0));
	if(!anySales){
		elTop.innerHTML = '<div style="color:#6b7280">Aún no hay ventas. Los productos más vendidos aparecerán aquí.</div>';
		return;
	}
	const top = getTopSold(3);
	top.forEach(p => {
		const score = (p._topScore || 0);
		const displayedScore = (Math.round(score * 100) / 100);
		const card = document.createElement('div'); card.className = 'card';
		card.innerHTML = `
			<img src="${p.img || 'https://i.imgur.com/8Km9tLL.png'}" alt="${escapeHtml(p.name)}" />
			<div class="card-body">
				<div class="card-title">
					<h3>${escapeHtml(p.name)}</h3>
					<strong>${formatCurrency(p.price)}</strong>
				</div>
				<p>${escapeHtml(p.desc || '')}</p>
				<div class="card-actions">
					<button class="add-btn" data-id="${p.id}">Agregar</button>
					<span style="color:#6b7280;font-size:13px">Ventas tot: ${p.sales || 0} • Score: ${displayedScore}</span>
				</div>
			</div>
		`;
		// permitir abrir modal al clicar la tarjeta también
		card.onclick = (ev) => {
			if(ev.target && ev.target.classList && ev.target.classList.contains('add-btn')) return;
			openProductModal(p.id);
		};
		elTop.appendChild(card);
	});
	// attach handlers: abrir modal en vez de añadir directo
	elTop.querySelectorAll('.add-btn').forEach(b => b.onclick = (e) => {
		const id = e.currentTarget.dataset.id;
		openProductModal(id);
	});
}

// --- Product modal & cart-with-options (nuevo) ---
const prodModal = document.getElementById('prodModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalPrice = document.getElementById('modalPrice');
const modalProtein = document.getElementById('modalProtein');
const modalQty = document.getElementById('modalQty');
const modalAddBtn = document.getElementById('modalAddBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

let currentProductId = null;

// default protein options if producto no tiene opciones específicas
const DEFAULT_PROTEINS = ['Salmón', 'Atún', 'Camarón', 'Pollo', 'Vegetariano'];

// abrir modal con datos del producto
function openProductModal(id){
	const p = products.find(x => x.id === id);
	if(!p) return;
	currentProductId = id;
	modalImage.src = p.img || 'https://i.imgur.com/8Km9tLL.png';
	modalTitle.textContent = p.name;
	modalDesc.textContent = p.desc || '';
	modalPrice.textContent = formatCurrency(p.price);
	// llenar select de proteínas: usar p.proteins si existe, si no usar DEFAULT_PROTEINS
	const opts = Array.isArray(p.proteins) && p.proteins.length ? p.proteins : DEFAULT_PROTEINS;
	modalProtein.innerHTML = '';
	opts.forEach(o => {
		const optEl = document.createElement('option');
		optEl.value = o;
		optEl.textContent = o;
		modalProtein.appendChild(optEl);
	});
	modalQty.value = 1;
	modalNote.textContent = p.note || '';
	prodModal.classList.add('open'); prodModal.setAttribute('aria-hidden','false');
}

// cerrar modal
function closeProductModal(){ prodModal.classList.remove('open'); prodModal.setAttribute('aria-hidden','true'); currentProductId = null; }

// modal buttons handlers
modalCloseBtn.addEventListener('click', closeProductModal);
modalAddBtn.addEventListener('click', () => {
	if(!currentProductId) return;
	const opt = modalProtein.value || '';
	const qty = Number(modalQty.value) || 1;
	addToCart(currentProductId, opt, qty);
	closeProductModal();
});

// { changed code }: helper para formatear moneda a pesos mexicanos
function formatCurrency(value){
	return '$' + Number(value || 0).toFixed(2) + ' MXN';
}

// Checkout modal handling
const checkoutModal = document.getElementById('checkoutModal');
const checkoutItemsEl = document.getElementById('checkoutItems');
const checkoutTotalEl = document.getElementById('checkoutTotal');
const confirmCheckoutBtn = document.getElementById('confirmCheckoutBtn');
const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
const checkoutStatus = document.getElementById('checkoutStatus');

function openCheckoutModal(){
	if(cart.length === 0){
		return alert('El carrito está vacío.');
	}
	// mostrar items
	checkoutItemsEl.innerHTML = '';
	let total = 0;
	cart.forEach(it => {
		const p = products.find(x => x.id === it.id);
		if(!p) return;
		const line = document.createElement('div');
		line.style.display = 'flex';
		line.style.justifyContent = 'space-between';
		line.style.padding = '6px 0';
		line.innerHTML = `<div>${escapeHtml(p.name)} ${it.option ? ' • ' + escapeHtml(it.option) : ''} x${it.qty}</div><div>${formatCurrency(p.price * it.qty)}</div>`;
		checkoutItemsEl.appendChild(line);
		total += p.price * it.qty;
	});
	checkoutTotalEl.textContent = formatCurrency(total);
	checkoutStatus.textContent = '';
	checkoutModal.classList.add('open'); checkoutModal.setAttribute('aria-hidden','false');
}

closeCheckoutBtn.addEventListener('click', () => {
	checkoutModal.classList.remove('open'); checkoutModal.setAttribute('aria-hidden','true');
});

// Confirmar pago (simulado) — valida dirección, registra ventas y vacía carrito
confirmCheckoutBtn.addEventListener('click', async () => {
	// validar dirección
	const addr = loadAddress();
	if(!addr || !addr.display){
		// pedir al usuario que agregue dirección
		if(!confirm('No hay dirección de entrega. ¿Quieres agregarla ahora?')) return;
		// abrir modal de dirección
		editAddrBtn.click();
		return;
	}
	// simular proceso de pago
	checkoutStatus.textContent = 'Procesando pago...';
	confirmCheckoutBtn.disabled = true;
	try{
		await new Promise(r => setTimeout(r, 900)); // simulación
		// registrar ventas y limpiar carrito
		recordSales(cart);
		cart = [];
		saveCart(cart);
		renderCart();
		renderTopProducts();
		checkoutStatus.textContent = 'Pago confirmado. ¡Gracias por tu pedido!';
		setTimeout(() => {
			checkoutModal.classList.remove('open'); checkoutModal.setAttribute('aria-hidden','true');
			checkoutStatus.textContent = '';
		}, 1200);
	}catch(e){
		checkoutStatus.textContent = 'Error procesando pago.';
	}finally{
		confirmCheckoutBtn.disabled = false;
	}
});

// { changed code }: reasignar el handler del botón "Pagar" para abrir el modal
el.checkout.onclick = () => {
	openCheckoutModal();
};

// { changed code }: Asegúrate de usar formatCurrency en los renderers.
// Ejemplos concretos aplicados:
// - renderProducts: replace price display to use formatCurrency(p.price)
// - renderTopProducts: replace price display to use formatCurrency(p.price)
// - renderCart: replace price display to use formatCurrency(prod.price)

// Helpers
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

// Inicializar
renderProducts();
renderCart();
renderTopProducts();
