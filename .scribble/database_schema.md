# Database Schema

### Users

{
id: UUID,
email: string unique not null,
passwordHash: string not null,
role: enum(User) default enum(User.customer),
name: string, // by default derived from email prefix
contactNumber: string nullable,
createdAt: timestamp not null,
updatedAt: timestamp not null,
deletedAt: timestamp nullable
}

Note:

- For soft deletion and compliance with govt. regulations, we will not permanently delete user records. Instead, we will mark them as deleted and anonymize sensitive data.
- Fields: [email, passwordHash, name, contactNumber]
- Given fields will become null, name will be "Deleted User"

### Products

{
id: UUID,
sellerId: UUID references Users(id) not null,
name: string not null,
description: text nullable,
categoryId: string nullable, // UUID references Category(id) nullable
price: decimal(10,2) not null,
imageUrl: string nullable,
createdAt: timestamp not null,
updatedAt: timestamp not null,
deletedAt: timestamp nullable,
isLive: boolean default true, // is product currently available for purchase
unique(sellerId, name)
}

### Cart

Cart
{
id: UUID,
userId: UUID references Users(id) unique not null,
createdAt: timestamp not null,
updatedAt: timestamp not null
}

CartItems
{
id: UUID,
cartId: UUID references Cart(id) not null,
productId: UUID references Products(id) not null,
quantity: integer not null default 1,
unitPrice: decimal(10,2) not null,
totalPrice: decimal(10,2) not null,
createdAt: timestamp not null,
updatedAt: timestamp not null,
unique(cartId, productId)
}

### Orders

Orders
{
id: UUID,
userId: UUID references Users(id) not null,
status: enum(OrderStatus) default enum(OrderStatus.pending),
totalAmount: decimal(10,2) not null,
paymentMethod: string not null,
shippingAddressId: string not null, // UUID references Addresses(id) not null
placedAt: timestamp not null,
updatedAt: timestamp not null
}

OrderItems
{
id: UUID,
orderId: UUID references Orders(id) not null,
productId: UUID references Products(id) not null,
productName: string not null, // snapshot
category: string nullable, // snapshot
quantity: integer not null,
unitPrice: decimal(10,2) not null, // snapshot
totalPrice: decimal(10,2) not null, // snapshot
createdAt: timestamp not null,
updatedAt: timestamp not null
}

### Shipping Addresses

Addresses
{
id: UUID,
isDefault: boolean default false,
userId: UUID references Users(id) not null,
addressLine1: string not null,
addressLine2: string nullable,
city: string not null,
state: string not null,
zip: string not null,
country: string not null,
createdAt: timestamp not null,
updatedAt: timestamp not null,
deletedAt: timestamp nullable,
}

Note:

- Each user can have multiple shipping addresses, but only one can be marked as default.
- When a new address is created with isDefault=true, we will automatically set isDefault=false for all other addresses of that user.
- When a default address is deleted, we will set another existing address as default (if any).
- For soft deletion and compliance with govt. regulations, we will not permanently delete shipping address records. Instead, we will mark them as deleted and anonymize the address fields.
- Fields: [addressLine1, addressLine2, city, state, zip, country]
- Given fields will become null, addressLine1 will be "Deleted Address"

### Sessions

Sessions
{
id: UUID,
userId: UUID references Users(id) not null,
refreshToken: string not null, // stored as bcrypt/sha256 hash
createdAt: timestamp not null,
expiresAt: timestamp not null
}

### SellerProfiles

{
id: UUID,
userId: UUID references Users(id) unique not null,
storeName: string not null,
storeDescription: text nullable,
email: string nullable,
contactNumber: string nullable,
originAddressId: string nullable, // UUID references Addresses(id) nullable
createdAt: timestamp not null,
updatedAt: timestamp not null,
deletedAt: timestamp nullable
}

### Category

{
id: UUID,
name: string unique not null,
description: text nullable,
createdAt: timestamp not null,
updatedAt: timestamp not null,
deletedAt: timestamp nullable
}

### Inventory

{
id: UUID,
productId: string not null, // UUID references Products(id) not null
quantity: integer not null default 0,
createdAt: timestamp not null,
updatedAt: timestamp not null,
unique(productId)
}
