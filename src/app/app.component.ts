import {Component,signal,computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
type Product={name:string;category:string;price:number;image:string;variants:{label:string;price:number}[]};
type Item={name:string;image:string;variant:string;price:number;qty:number;sauce:string;topping:string};
type Order={id:string;name:string;phone:string;date:string;time:string;payment:string;items:Item[];total:number;status:string};
const image=(id:string)=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=900&q=85';
const seeded:Product[]=[
{name:'Slushies',category:'Slushies',price:15,image:image('photo-1497534446932-c925b458314e'),variants:[{label:'Small cup',price:15},{label:'Big cup',price:30}]},
{name:'Mini Donuts',category:'Mini Donuts',price:25,image:image('photo-1551024506-0bccd828d307'),variants:[{label:'6 donuts',price:25},{label:'12 donuts',price:50},{label:'24 donuts',price:95},{label:'50 donuts',price:210}]},
{name:'Milkshakes',category:'Milkshakes',price:25,image:image('photo-1572490122747-3968b75cc699'),variants:[{label:'Small',price:25},{label:'Large',price:40}]},
{name:'Ice Cream Sundaes',category:'Ice Cream Sundaes',price:30,image:image('photo-1563805042-7684c019e1cb'),variants:[{label:'Sage',price:30},{label:'Legacy',price:50},{label:'Chocolate Classic',price:120},{label:'Royal Buffet',price:150}]}];
function stored<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./app.component.html',styleUrl:'./app.component.css'})
export class AppComponent{
 products=seeded;page=signal('home');menu=false;category=signal('All');categories=['All',...seeded.map(x=>x.category)];selected=signal<Product>(seeded[1]);variant=signal('6 donuts');flavour=signal('Chocolate');topping=signal('Oreo');qty=signal(1);
 cart=signal<Item[]>(stored('rt-cart',[]));orders=signal<Order[]>(stored('rt-orders',[]));latest=signal<Order|null>(null);tracked=signal<Order|null>(null);trackRef='';trackPhone='';trackSearched=false;
 name='';phone='';date='';time='';payment='EFT';notes='';minDate=new Date(Date.now()+86400000).toISOString().slice(0,10);times=['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
 statuses=['Pending','Confirmed','Preparing','Ready for Collection','Completed','Cancelled'];
 filtered=computed(()=>this.products.filter(p=>this.category()==='All'||p.category===this.category()));
 unitPrice=computed(()=>this.selected().variants.find(v=>v.label===this.variant())?.price??this.selected().price);
 count=computed(()=>this.cart().reduce((n,x)=>n+x.qty,0));total=computed(()=>this.cart().reduce((n,x)=>n+x.qty*x.price,0));revenue=computed(()=>this.orders().filter(x=>x.status!=='Cancelled').reduce((n,x)=>n+x.total,0));
 pending=computed(()=>this.orders().filter(x=>x.status==='Pending').length);completed=computed(()=>this.orders().filter(x=>x.status==='Completed').length);
 go(p:string){this.page.set(p);this.menu=false;window.scrollTo(0,0)}
 open(p:Product){this.selected.set(p);this.variant.set(p.variants[0].label);this.flavour.set('Chocolate');this.topping.set('Oreo');this.qty.set(1);this.go('product')}
 saveCart(items:Item[]){this.cart.set(items);localStorage.setItem('rt-cart',JSON.stringify(items))}
 add(){const p=this.selected();const item={name:p.name,image:p.image,variant:this.variant(),price:this.unitPrice(),qty:this.qty(),sauce:this.flavour(),topping:this.topping()};const items=[...this.cart()];const old=items.find(i=>i.name===item.name&&i.variant===item.variant&&i.sauce===item.sauce&&i.topping===item.topping);if(old)old.qty+=item.qty;else items.push(item);this.saveCart(items);this.go('cart')}
 change(i:Item,d:number){this.saveCart(this.cart().map(x=>x===i?{...x,qty:x.qty+d}:x).filter(x=>x.qty>0))}
 remove(i:Item){this.saveCart(this.cart().filter(x=>x!==i))}
 place(){if(!this.name.trim()||!this.phone.trim()||!this.date||!this.time||!this.cart().length)return;const o:Order={id:'RT-'+Date.now().toString().slice(-8),name:this.name,phone:this.phone.replace(/\s/g,''),date:this.date,time:this.time,payment:this.payment,items:this.cart(),total:this.total(),status:'Pending'};this.orders.update(x=>[o,...x]);localStorage.setItem('rt-orders',JSON.stringify(this.orders()));this.latest.set(o);this.tracked.set(o);this.trackRef=o.id;this.trackPhone=o.phone;this.saveCart([]);this.go('success')}
 track(){this.trackSearched=true;this.tracked.set(this.orders().find(o=>o.id.toLowerCase()===this.trackRef.trim().toLowerCase()&&o.phone.replace(/\D/g,'')===this.trackPhone.replace(/\D/g,''))||null)}
 status(o:Order,s:string){this.orders.update(xs=>xs.map(x=>x.id===o.id?{...x,status:s}:x));localStorage.setItem('rt-orders',JSON.stringify(this.orders()));if(this.tracked()?.id===o.id)this.tracked.set({...o,status:s})}
}