import {Component,signal,computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CommerceState, CatalogueProduct, DeliveryOrder} from './commerce-state.service';
import {PortalComponent} from './portal.component';
import {inject} from '@angular/core';
type Item={name:string;image:string;variant:string;price:number;qty:number;sauce:string;topping:string;recipient?:string};
type Order={id:string;name:string;phone:string;date:string;time:string;payment:string;items:Item[];total:number;status:string;notes?:string};
function stored<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,PortalComponent],templateUrl:'./app.component.html',styleUrls:['./app.component.css','./responsive.css','./commerce-enhancements.css']})
export class AppComponent{
 store=inject(CommerceState);
 products=this.store.products;page=signal('home');menu=false;
 category=signal('All'); categories=computed(()=>['All',...new Set(this.store.products().map(x=>x.category))]);
 selected=signal<CatalogueProduct>(this.store.products()[1]);
 variant=signal('6 donuts');flavour=signal('Chocolate');topping=signal('Oreo');qty=signal(1);
 forPerson=''; searchText=signal(''); sortBy=signal('featured'); availableOnly=signal(false); menuPage=signal(1); readonly pageSize=8;
 showWelcome=signal(!localStorage.getItem('royal-welcome-v1'));
 supportSubject='Order support';supportMessage='';

 cart=signal<Item[]>(stored('rt-cart',[]));orders=signal<Order[]>(stored('rt-orders',[]));latest=signal<Order|null>(null);tracked=signal<Order|null>(null);trackRef='';trackPhone='';trackSearched=false;
 name='';phone='';date='';time='';payment='Cash on Collection';notes='';
 fulfillment:'collection'|'delivery'='collection';deliveryAddress='';deliveryLat=signal<number|null>(null);deliveryLng=signal<number|null>(null);locationMessage='';
 checkoutError='';minDate=new Date(Date.now()+86400000).toISOString().slice(0,10);times=computed(()=>Array.from({length:48},(_,i)=>String(Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00')).filter(t=>this.store.inHours(t)));
 statuses=['Pending','Confirmed','Preparing','Ready for Collection','Completed','Cancelled'];
 filtered=computed(()=>{
  let items=this.store.products().filter(p=>(this.category()==='All'||p.category===this.category())&&
    (!this.availableOnly()||p.available)&&
    [p.name,p.category,p.description].some(value=>value.toLowerCase().includes(this.searchText().trim().toLowerCase())));
  if(this.sortBy()==='price-low')items=[...items].sort((a,b)=>a.price-b.price);
  if(this.sortBy()==='price-high')items=[...items].sort((a,b)=>b.price-a.price);
  if(this.sortBy()==='name')items=[...items].sort((a,b)=>a.name.localeCompare(b.name));
  return items;
 });
 totalPages=computed(()=>Math.max(1,Math.ceil(this.filtered().length/this.pageSize)));
 visibleProducts=computed(()=>this.filtered().slice((this.menuPage()-1)*this.pageSize,this.menuPage()*this.pageSize));
 pageNumbers=computed(()=>{
  const total=this.totalPages();
  const count=Math.min(5,total);
  const start=Math.max(1,Math.min(this.menuPage()-2,total-count+1));
  return Array.from({length:count},(_,index)=>start+index);
 });
 groupRecipients=computed(()=>[...new Set(this.cart().map(i=>i.recipient?.trim()||'Shared treats'))]);

 deliveryCheck=computed(()=>this.store.canDeliver(this.cart(),this.deliveryLat(),this.deliveryLng()));
 eligibleForDelivery=computed(()=>this.cart().every(i=>this.store.products().some(p=>p.name===i.name&&p.deliverable&&p.available))&&this.cart().length>0);
 unitPrice=computed(()=>this.selected().variants.find(v=>v.label===this.variant())?.price??this.selected().price);
 count=computed(()=>this.cart().reduce((n,x)=>n+x.qty,0));total=computed(()=>this.cart().reduce((n,x)=>n+x.qty*x.price,0));revenue=computed(()=>this.orders().filter(x=>x.status!=='Cancelled').reduce((n,x)=>n+x.total,0));
 pending=computed(()=>this.orders().filter(x=>x.status==='Pending').length);completed=computed(()=>this.orders().filter(x=>x.status==='Completed').length);
 constructor(){if(this.showWelcome())setTimeout(()=>this.dismissWelcome(),2200)}
 dismissWelcome(){this.showWelcome.set(false);localStorage.setItem('royal-welcome-v1','yes')}
 signOut(){this.store.signOut();this.go('home')}
 updateSearch(value:string){this.searchText.set(value);this.menuPage.set(1)}
 clearFilters(){this.searchText.set('');this.category.set('All');this.sortBy.set('featured');this.availableOnly.set(false);this.menuPage.set(1)}
 setCategory(cat:string){this.category.set(cat);this.menuPage.set(1)}
 setSort(value:string){this.sortBy.set(value);this.menuPage.set(1)}
 setAvailable(value:boolean){this.availableOnly.set(value);this.menuPage.set(1)}
 setPage(n:number){this.menuPage.set(Math.max(1,Math.min(this.totalPages(),n)));window.scrollTo(0,220)}
 saveRecipient(item:Item,recipient:string){this.saveCart(this.cart().map(x=>x===item?{...x,recipient:recipient.slice(0,45)}:x))}
 emailReady(){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.store.settings().supportEmail||'')}
 supportHref(){const email=this.store.settings().supportEmail;return 'mailto:'+email+'?subject='+encodeURIComponent(this.supportSubject)+'&body='+encodeURIComponent(this.supportMessage)}

 go(p:string){if(p.startsWith('admin'))p='portal';if(p==='checkout'&&this.store.session()?.role==='customer'){this.name=this.store.session()!.name;this.phone=this.store.session()!.phone}this.page.set(p);this.menu=false;window.scrollTo(0,0)}
 selectedAvailable(){return !!this.store.products().find(p=>p.name===this.selected().name)?.available}
 open(p:CatalogueProduct){if(!this.store.products().find(x=>x.name===p.name)?.available)return;this.selected.set(p);this.variant.set(p.variants[0].label);this.flavour.set('Chocolate');this.topping.set('Oreo');this.qty.set(1);this.forPerson='';this.go('product')}
 saveCart(items:Item[]){this.cart.set(items);localStorage.setItem('rt-cart',JSON.stringify(items))}
 add(){const p=this.selected();if(!this.store.products().find(x=>x.name===p.name)?.available)return;const item={name:p.name,image:p.image,variant:this.variant(),price:this.unitPrice(),qty:this.qty(),sauce:this.flavour(),topping:this.topping(),recipient:this.forPerson.trim().slice(0,45)};const items=[...this.cart()];const old=items.find(i=>i.name===item.name&&i.variant===item.variant&&i.sauce===item.sauce&&i.topping===item.topping&&(i.recipient||'')===(item.recipient||''));if(old)old.qty+=item.qty;else items.push(item);this.saveCart(items);this.go('cart')}
 change(i:Item,d:number){this.saveCart(this.cart().map(x=>x===i?{...x,qty:x.qty+d}:x).filter(x=>x.qty>0))}
 remove(i:Item){this.saveCart(this.cart().filter(x=>x!==i))}
 useDeliveryLocation(){this.locationMessage='';if(!navigator.geolocation){this.locationMessage='Geolocation is not available. Choose collection.';return}navigator.geolocation.getCurrentPosition(pos=>{this.deliveryLat.set(pos.coords.latitude);this.deliveryLng.set(pos.coords.longitude);this.locationMessage='Location captured. '+this.store.canDeliver(this.cart(),this.deliveryLat(),this.deliveryLng()).reason},()=>{this.locationMessage='Could not get your location. Enable location permission or choose collection.'},{enableHighAccuracy:true,timeout:15000})}
 place(){
  this.checkoutError='';
  if(this.store.session()?.role!=='customer'){this.checkoutError='Please sign in or register as a customer before placing an order.';return}
  if(!this.name.trim()||!this.phone.trim()||!this.date||!this.time||!this.cart().length){this.checkoutError='Complete your contact details and collection time.';return}
  if(!this.store.inHours(this.time)){this.checkoutError='Choose a time within the store opening hours.';return}
  if(this.cart().some(i=>!this.store.products().some(p=>p.name===i.name&&p.available))){this.checkoutError='An item is now out of stock. Please update your cart.';return}
  if(this.fulfillment==='delivery'&&(!this.deliveryCheck().ok||!this.deliveryAddress.trim())){this.checkoutError='Delivery requires a valid location within 5 km and a delivery address.';return}
  const user=this.store.session();
  const o:Order={id:'RT-'+Date.now().toString().slice(-8),name:this.name,phone:this.phone.replace(/\s/g,''),date:this.date,time:this.time,payment:this.fulfillment==='delivery'?'Cash on Delivery':'Cash on Collection',items:this.cart(),total:this.total(),status:'Pending',notes:this.notes};
  this.orders.update(x=>[o,...x]);localStorage.setItem('rt-orders',JSON.stringify(this.orders()));
  const delivery:DeliveryOrder={id:o.id,customerId:user?.id||'guest',customer:o.name,phone:o.phone,address:this.fulfillment==='delivery'?this.deliveryAddress:'',latitude:this.deliveryLat()??undefined,longitude:this.deliveryLng()??undefined,distanceKm:this.deliveryCheck().distance??undefined,fulfillment:this.fulfillment,status:'Pending',payment:o.payment,total:o.total,items:o.items.map(i=>({name:i.name,qty:i.qty,price:i.price,recipient:i.recipient})),date:o.date,time:o.time,notes:this.notes};
  this.store.record(delivery);this.latest.set(o);this.tracked.set(o);this.trackRef=o.id;this.trackPhone=o.phone;this.saveCart([]);this.go('success')
 }
 track(){this.trackSearched=true;const entry=this.store.deliveries().find(o=>o.id.toLowerCase()===this.trackRef.trim().toLowerCase()&&o.phone.replace(/\D/g,'')===this.trackPhone.replace(/\D/g,''));const old=this.orders().find(o=>o.id===entry?.id);this.tracked.set(entry&&old?{...old,status:entry.status}:null)}
 status(o:Order,s:string){this.orders.update(xs=>xs.map(x=>x.id===o.id?{...x,status:s}:x));localStorage.setItem('rt-orders',JSON.stringify(this.orders()));if(this.tracked()?.id===o.id)this.tracked.set({...o,status:s})}
}