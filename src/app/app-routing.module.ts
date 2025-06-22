import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CustomerManagmentComponent } from './customer-managment/customer-managment.component';
import { FeedbackComponent } from './feedback/feedback.component';

const routes: Routes = [
  // { path: '', component: DashboardComponent },
  // { path: 'update-product', component: UpdateProductComponent },
  // { path: 'product', component: ProductComponent },
  // { path: 'addproduct', component: AddProductComponent },
  // { path: 'addblog', component: AddBlogComponent },
  { path: 'customer', component: CustomerManagmentComponent },
  // { path: 'order', component: OrderComponent }, 
  // { path: 'category', component: CategoryComponent }, 
  { path: 'feedback', component: FeedbackComponent }, 
  // { path: 'blog', component: BlogComponent },
  // { path: 'view-product-detail/:id', component: UpdateProductComponent },
  // { path: 'view-order-detail/:id', component: UpdateOrderComponent },
  // { path: 'view-blog-detail/:id', component: BlogUpdateComponent },
  // { path: 'view-user-detail/:id', component: CustomerUpdateComponent }


];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
