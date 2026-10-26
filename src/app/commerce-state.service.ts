import { Injectable, signal } from '@angular/core';

export type Role = 'admin' | 'customer' | 'courier';
export type Account = { id: string; name: string; email: string; phone: string; whatsapp?: string; role: Role; password: string; active: boolean };
export type CatalogueProduct = { id: string; name: string; category: string; price: number; image: string; description: string; available: boolean; deliverable: boolean; variants: { label: string; price: number }[] };
export type Settings = { open: string; close: string; latitude: number | null; longitude: number | null; radiusKm: number; storeName: string; address: string };
export type DeliveryOrder = { id: string; customerId: string; customer: string; phone: string; whatsapp?: string; address: string; latitude?: number; longitude?: number; distanceKm?: number; fulfillment: 'delivery'|'collection'; courierId?: string; status: string; payment: string; total: number; items: {name:string;qty:number;price:number}[]; date: string; time: string };

const seedProducts: CatalogueProduct[] = [
 { id: 'slush', name: 'Slushies', category: 'Slushies', price: 15, image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=85', description:'Lemon Lime, Strawberry or Blueberry', available:true,deliverable:false, variants:[{label:'Small cup',price:15},{label:'Big cup',price:30}] },
 { id: 'donuts', name: 'Mini Donuts', category: 'Mini Donuts', price:25, image:'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85',description:'Fresh mini donuts with your favourite toppings',available:true,deliverable:true,variants:[{label:'6 donuts',price:25},{label:'12 donuts',price:50},{label:'24 donuts',price:95},{label:'50 donuts',price:210}] },
 { id: 'shake', name: 'Milkshakes', category:'Milkshakes',price:25,image:'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=85',description:'Creamy milkshakes',available:true,deliverable:false,variants:[{label:'Small',price:25},{label:'Large',price:40}] },
 { id:'sundae',name:'Ice Cream Sundaes',category:'Ice Cream Sundaes',price:30,image:'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=85',description:'Sage, Legacy and Royal Buffet sundaes',available:true,deliverable:false,variants:[{label:'Sage',price:30},{label:'Legacy',price:50},{label:'Chocolate Classic',price:120},{label:'Royal Buffet',price:150}] }
];
const read = <T>(key: string, fallback: T): T => {
 try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const demoAdmin: Account = { id:'admin-demo', name:'Royal Treats Admin',email:'admin@royaltreats.demo',phone:'0000000000',role:'admin',password:'Demo@12345',active:true };

@Injectable({providedIn:'root'})
export class CommerceState {
 readonly products = signal<CatalogueProduct[]>(read('royal-products-v2',seedProducts));
 readonly accounts = signal<Account[]>(read('royal-accounts-v2',[demoAdmin]));
 readonly session = signal<Account|null>(null);
 readonly settings = signal<Settings>(read('royal-settings-v2',{open:'10:00',close:'23:00',latitude:null,longitude:null,radiusKm:5,storeName:'Royal Treats',address:'34 10th Avenue, Thabazimbi'}));
 readonly deliveries = signal<DeliveryOrder[]>(read('royal-deliveries-v2',[]));
 constructor() {
  const id = sessionStorage.getItem('royal-demo-session');
  if(id) this.session.set(this.accounts().find(a=>a.id===id&&a.active)??null);
 }
 private save<T>(key:string,sig:{():T},value:T):void{ localStorage.setItem(key,JSON.stringify(value)); }
 register(name:string,email:string,phone:string,whatsapp:string,password:string):string|null{
  const normalized=email.trim().toLowerCase();
  if(!name.trim()||!normalized||!/^\+?[0-9 ]{9,16}$/.test(phone)||password.length<8) return 'Please enter a name, email, valid phone and password of at least 8 characters.';
  if(this.accounts().some(a=>a.email===normalized))return 'That email is already registered.';
  const account:Account={id:'u-'+Date.now(),name:name.trim(),email:normalized,phone:phone.trim(),whatsapp:whatsapp.trim()||undefined,password,role:'customer',active:true};
  this.accounts.update(xs=>[...xs,account]);this.save('royal-accounts-v2',this.accounts,this.accounts());this.signIn(normalized,password);return null;
 }
 signIn(email:string,password:string):boolean{
  const a=this.accounts().find(x=>x.email===email.trim().toLowerCase()&&x.password===password&&x.active);
  this.session.set(a??null);if(a)sessionStorage.setItem('royal-demo-session',a.id);return !!a;
 }
 signOut():void{this.session.set(null);sessionStorage.removeItem('royal-demo-session');}
 addCourier(name:string,email:string,phone:string,whatsapp:string,password:string):string|null{
  if(this.session()?.role!=='admin')return 'Admin role required.';
  const normalized=email.trim().toLowerCase();
  if(!name.trim()||!normalized||!/^\+?[0-9 ]{9,16}$/.test(phone)||password.length<8)return 'Name, valid phone, email and password of at least 8 characters are required.';
  if(this.accounts().some(a=>a.email===normalized))return 'Email already registered.';
  this.accounts.update(xs=>[...xs,{id:'courier-'+Date.now(),name,email:normalized,phone,whatsapp:whatsapp||undefined,password,role:'courier',active:true}]);this.save('royal-accounts-v2',this.accounts,this.accounts());return null;
 }
 toggleAccount(id:string):void{if(this.session()?.role!=='admin')return;this.accounts.update(xs=>xs.map(a=>a.id===id&&a.role==='courier'?{...a,active:!a.active}:a));this.save('royal-accounts-v2',this.accounts,this.accounts());}
 saveProduct(p:CatalogueProduct):void{
  if(this.session()?.role!=='admin')return;
  // The MVP supports delivery of donuts only, regardless of product configuration.
  const product={...p,deliverable:p.category==='Mini Donuts'&&p.deliverable};
  this.products.update(xs=>xs.some(x=>x.id===product.id)?xs.map(x=>x.id===product.id?product:x):[...xs,product]);this.save('royal-products-v2',this.products,this.products());
 }
 saveSettings(s:Settings):void{if(this.session()?.role!=='admin')return;this.settings.set({...s,radiusKm:5});this.save('royal-settings-v2',this.settings,this.settings());}
 record(order:DeliveryOrder):void{this.deliveries.update(xs=>[order,...xs]);this.save('royal-deliveries-v2',this.deliveries,this.deliveries());}
 setOrder(id:string,status:string,courierId?:string):void{
  const user=this.session();if(!user||user.role==='customer')return;
  this.deliveries.update(xs=>xs.map(o=>o.id===id?{...o,status,courierId:courierId===undefined?o.courierId:courierId}:o));this.save('royal-deliveries-v2',this.deliveries,this.deliveries());
 }
 acceptOrder(id:string):boolean{
  const user=this.session();if(user?.role!=='courier')return false;
  const order=this.deliveries().find(x=>x.id===id);
  if(!order||order.fulfillment!=='delivery'||order.courierId||order.status!=='Ready for Delivery')return false;
  this.setOrder(id,'Out for Delivery',user.id);return true;
 }
 distanceKm(lat:number,lng:number):number|null{
  const s=this.settings();if(s.latitude===null||s.longitude===null)return null;
  const rad=(n:number)=>n*Math.PI/180;
  const a=Math.sin(rad(lat-s.latitude)/2)**2+Math.cos(rad(s.latitude))*Math.cos(rad(lat))*Math.sin(rad(lng-s.longitude)/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(a)));
 }
 canDeliver(items:{name:string}[],lat:number|null,lng:number|null):{ok:boolean;reason:string;distance:number|null}{
  if(!items.length)return {ok:false,reason:'Your cart is empty.',distance:null};
  if(items.some(i=>!this.products().some(p=>p.name===i.name&&p.category==='Mini Donuts'&&p.deliverable&&p.available)))return {ok:false,reason:'Only in-stock mini donut products are eligible for delivery. Remove other items or choose collection.',distance:null};
  if(lat===null||lng===null)return {ok:false,reason:'Provide your location to check the 5 km delivery area.',distance:null};
  const d=this.distanceKm(lat,lng);
  if(d===null)return {ok:false,reason:'Store location needs to be configured by the admin.',distance:null};
  return {ok:d<=5,reason:d<=5?'Within the delivery area.':'Outside the 5 km delivery area.',distance:d};
 }
 inHours(time:string):boolean{const s=this.settings();return s.open<=s.close?time>=s.open&&time<=s.close:time>=s.open||time<=s.close;}
}
