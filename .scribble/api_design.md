# API Design

## User Authentication

1. Signup

   method: post
   route: /auth/register
   route access: public

   body:
   {
   email: string,
   password: string
   }

2. Login

   method: post
   route: /auth/login
   route access: public

   body:
   {
   email: string,
   password: string
   }

3. Logout

   method: post
   route: /auth/logout
   route access: private

4. Refresh access token

   method: post
   route: /auth/refresh-token
   route access: private

## Products

1. List products

   method: get
   route: /products
   route access: public

2. Get product details

   method: get
   route: /products/:id
   route access: public

3. Create product

   method: post
   route: /products
   route access: private
   role needed: [seller, admin]

   body:
   {
   name: string,
   description: string,
   price: number,
   stock: number
   }

4. Update product

   method: put
   route: /products/:id
   route access: private
   role needed: [seller (ownership needed), admin]

   body:
   {
   name?: string,
   description?: string,
   price?: number,
   stock?: number
   }

5. Delete product

   method: delete
   route: /products/:id
   route access: private
   role needed: [seller (ownership needed), admin]

## Cart management

1. Get cart

   method: get
   route: /cart
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

2. Add item to cart

   method: post
   route: /cart/items
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

   body:
   {
   productId: string,
   quantity: number
   }

3. Update cart item

   method: put
   route: /cart/items/:itemId
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

   body:
   {
   quantity: number
   }

4. Remove item from cart

   method: delete
   route: /cart/items/:itemId
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

## Order management

1. Create order

   method: post
   route: /orders
   route access: private
   role needed: [customer, seller, admin]

   body:
   {
   paymentMethod: string,
   shippingAddressId: string, // UUID
   }

2. Get order details

   method: get
   route: /orders/:id
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

3. List user orders

   method: get
   route: /orders
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

4. Cancel order

   method: post
   route: /orders/:id/cancel
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

   Note:
   - Order only changes status to 'cancelled'.
   - Cancellation is only allowed if order is in 'pending' status.

5. List all orders for seller

   method: get
   route: /seller/orders
   route access: private
   role needed: [seller (only orders containing their products), admin]

6. Get order details for seller

   method: get
   route: /seller/orders/:id
   route access: private
   role needed: [seller (only if order contains their products), admin]

7. Cancel order as seller

   method: post
   route: /seller/orders/:id/cancel
   route access: private
   role needed: [seller (only if order contains their products), admin]

   Note:
   - Order only changes status to 'cancelled'.
   - Cancellation is only allowed if order is in 'pending' status.

8. Update order status

   method: put
   route: /seller/orders/:id/status
   route access: private
   role needed: [seller (only if order contains their products), admin]

   body:
   {
   status: enum('pending', 'paid', 'shipped', 'completed', 'cancelled')
   }

## Addresses

1. List addresses

   method: get
   route: /addresses
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

2. Create address

   method: post
   route: /addresses
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

   body:
   {
   addressLine1: string,
   addressLine2?: string,
   city: string,
   state: string,
   zip: string,
   country: string,
   isDefault?: boolean
   }

3. Update address

   method: put
   route: /addresses/:id
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

   body:
   {
   addressLine1?: string,
   addressLine2?: string,
   city?: string,
   state?: string,
   zip?: string,
   country?: string,
   isDefault?: boolean
   }

4. Delete address

   method: delete
   route: /addresses/:id
   route access: private
   role needed: [customer (ownership needed), seller (ownership needed), admin]

## User management

1. Get user profile

   method: get
   route: /users/me
   route access: private
   role needed: [customer, seller, admin]

2. Update user profile

   method: put
   route: /users/me
   route access: private
   role needed: [customer, seller, admin]

   body:
   {
   name?: string,
   contactNumber?: string
   }

3. Delete user account

   method: post
   route: /users/me/delete
   route access: private
   role needed: [customer, seller, admin]

   Note:
   - We will not permanently delete user accounts. Instead, we will mark them as deleted and anonymize sensitive data.
   - Fields: [email, passwordHash, name, contactNumber]
   - Given fields will become null, name will be "Deleted User"

## Seller profile management

1. Create seller profile

   method: post
   route: /seller/profile
   route access: private
   role needed: [customer (ownership needed), admin]

   body:
   {
   storeName: string,
   storeDescription?: string,
   email?: string,
   contactNumber?: string,
   originAddressId?: string // UUID of an existing address
   }

2. Get their seller profile

   method: get
   route: /seller/profile
   route access: private
   role needed: [seller]

3. Update seller profile

   method: put
   route: /seller/profile
   route access: private
   role needed: [seller]

   body:
   {
   storeName?: string,
   storeDescription?: string,
   email?: string,
   contactNumber?: string,
   originAddressId?: string // UUID of an existing address
   }

4. Delete seller profile

   method: post
   route: /seller/profile/delete
   route access: private
   role needed: [seller]

   Note:
   - We will only soft-delete seller profiles.
   - The seller profile can still be seen on previous orders.

## Seller Inventory management

1. Get inventory for all products of the seller

   method: get
   route: /seller/inventory
   route access: private
   role needed: [seller, admin]

2. Get inventory for a product

   method: get
   route: /seller/inventory/:productId
   route access: private
   role needed: [seller (only if they own the product), admin]

3. Update inventory for a product

   method: put
   route: /seller/inventory/:productId
   route access: private
   role needed: [seller (only if they own the product), admin]

   body:
   {
   quantity: number
   }

## Category management

1. List categories

   method: get
   route: /categories
   route access: public

2. Create category

   method: post
   route: /categories
   route access: private
   role needed: [admin]

   body:
   {
   name: string
   }

3. Update category

   method: put
   route: /categories/:id
   route access: private
   role needed: [admin]

   body:
   {
   name?: string,
   description?: string
   }

4. Delete category

   method: delete
   route: /categories/:id
   route access: private
   role needed: [admin]

   Note:
   - We only soft-delete categories.
   - We move the products of the deleted category to a default "Uncategorized" category.

## Admin management

### User management

1. List all users on the platform

   method: get
   route: /admin/users
   route access: private
   role needed: [admin]

2. Bulk delete users

   method: post
   route: /admin/users/bulk-delete
   route access: private
   role needed: [admin]

   body:
   {
   userIds: string[] // array of user UUIDs to delete
   }

### Seller management

1. List all sellers on the platform

   method: get
   route: /admin/sellers
   route access: private
   role needed: [admin]

2. Bulk delete sellers

   method: post
   route: /admin/sellers/bulk-delete
   route access: private
   role needed: [admin]

   body:
   {
   sellerIds: string[] // array of seller UUIDs to delete
   }

### Order management

1. List all orders on the platform

   method: get
   route: /admin/orders
   route access: private
   role needed: [admin]

2. Bulk cancel orders

   method: post
   route: /admin/orders/bulk-cancel
   route access: private
   role needed: [admin]

   body:
   {
   orderIds: string[] // array of order UUIDs to cancel
   }

   Note:
   - Orders only change status to 'cancelled'.
   - Cancellation is only allowed if order is in 'pending' status.
