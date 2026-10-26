import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceState, CatalogueProduct, Settings } from './commerce-state.service';

@Component({selector:'app-portal',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./portal.component.html',styleUrl:'./portal.component.css'})
export class PortalComponent {
 readonly store=inject(CommerceState);
 screen=signal<'signin'|'register'|'home'|'products'|'couriers'|'settings'|'orders'>('signin');
 error=''; notice=''; email='';password='';name='';phone='';whatsapp='';
 courier={name:'',email:'',phone:'',whatsapp:'',password:''};
 edited:CatalogueProduct|null=null;imageError='';isUploading=false;
 settings:Settings={...this.store.settings()};
 constructor(){if(this.store.session())this.screen.set('home')}
 login(){this.error='';if(!this.store.signIn(this.email,this.password)){this.error='Incorrect email or password (demo account on this device).';return}this.screen.set('home');this.password=''}
 register(){this.error=this.store.register(this.name,this.email,this.phone,this.whatsapp,this.password)||'';if(!this.error){this.screen.set('home');this.password=''}}
 logout(){this.store.signOut();this.screen.set('signin');this.error=''}
 nav(to:'home'|'products'|'couriers'|'settings'|'orders'){this.notice='';this.error='';if(to==='settings')this.settings={...this.store.settings()};this.screen.set(to)}
 createCourier(){this.error=this.store.addCourier(this.courier.name,this.courier.email,this.courier.phone,this.courier.whatsapp,this.courier.password)||'';if(!this.error){this.notice='Delivery person added. Their sign-in works in this browser demo only.';this.courier={name:'',email:'',phone:'',whatsapp:'',password:''}}}
 edit(p?:CatalogueProduct){this.edited=p?JSON.parse(JSON.stringify(p)) as CatalogueProduct:{id:'p-'+Date.now(),name:'',category:'Mini Donuts',price:25,image:'',description:'',available:true,deliverable:true,variants:[{label:'Standard',price:25}]};this.imageError=''}
 addVariant(){if(this.edited)this.edited.variants.push({label:'New size',price:this.edited.price})}
 removeVariant(i:number){if(this.edited&&this.edited.variants.length>1)this.edited.variants.splice(i,1)}
 saveProduct(){const p=this.edited;if(!p||!p.name.trim()||p.price<0){this.error='Enter a valid product name and price.';return}if(!p.variants.length)p.variants=[{label:'Standard',price:p.price}];this.store.saveProduct(p);this.edited=null;this.notice='Product saved.';this.error=''}
 upload(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file||!this.edited)return;this.imageError='';if(!file.type.startsWith('image/')){this.imageError='Choose an image file.';return}if(file.size>400_000){this.imageError='For this browser-only demo, choose an image under 400 KB.';return}const reader=new FileReader();reader.onload=()=>{if(this.edited)this.edited.image=String(reader.result)};reader.readAsDataURL(file)}
 saveHours(){if(this.settings.open===this.settings.close){this.error='Opening and closing time must differ.';return}if(this.settings.latitude!==null&&(this.settings.latitude< -90||this.settings.latitude>90)||this.settings.longitude!==null&&(this.settings.longitude< -180||this.settings.longitude>180)){this.error='Invalid latitude or longitude.';return}this.store.saveSettings(this.settings);this.error='';this.notice='Business settings saved.'}
 useStoreLocation(){if(!navigator.geolocation){this.error='Location is unavailable.';return}navigator.geolocation.getCurrentPosition(p=>{this.settings.latitude=p.coords.latitude;this.settings.longitude=p.coords.longitude;this.error='';this.notice='Store coordinates captured from this device. Save settings to apply.'},()=>this.error='Location permission denied. Enter store coordinates manually.')}
 toggleAvailability(product: CatalogueProduct): void {
  this.store.saveProduct({ ...product, available: !product.available });
 }
 outOfStockCount(){return this.store.products().filter(p=>!p.available).length}
 couriers(){return this.store.accounts().filter(x=>x.role==='courier')}
 availableOrders(){return this.store.deliveries().filter(o=>o.fulfillment==='delivery'&&o.status==='Ready for Delivery'&&!o.courierId)}
 ownOrders(){return this.store.deliveries().filter(o=>o.courierId===this.store.session()?.id)}
 accept(id:string){this.error=this.store.acceptOrder(id)?'':'Order is no longer available.';if(!this.error)this.notice='Order accepted. Contact the customer before delivery.'}
 saveOrder(id:string,status:string){this.store.setOrder(id,status)}
}
