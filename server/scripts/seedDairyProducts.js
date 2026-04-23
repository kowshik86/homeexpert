const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const shopItemsModel = require('../models/shopItemsModel');

const DEFAULT_DAIRY_QUANTITY = 50;

const DAIRY_PRODUCTS = [
  {
    name: 'Toned Milk 1L',
    imageUrl: 'https://via.placeholder.com/300x200?text=Toned+Milk',
    cost: 62,
    description: 'Fresh toned milk, 1 liter pack.',
  },
  {
    name: 'Full Cream Milk 1L',
    imageUrl: 'https://via.placeholder.com/300x200?text=Full+Cream+Milk',
    cost: 70,
    description: 'Rich full cream milk, 1 liter pack.',
  },
  {
    name: 'Curd 500g',
    imageUrl: 'https://via.placeholder.com/300x200?text=Curd',
    cost: 48,
    description: 'Thick and fresh curd, 500 gram cup.',
  },
  {
    name: 'Paneer 200g',
    imageUrl: 'https://via.placeholder.com/300x200?text=Paneer',
    cost: 95,
    description: 'Soft paneer cubes, ideal for curries and snacks.',
  },
  {
    name: 'Butter 100g',
    imageUrl: 'https://via.placeholder.com/300x200?text=Butter',
    cost: 58,
    description: 'Creamy table butter, 100 gram block.',
  },
  {
    name: 'Cheese Slices 200g',
    imageUrl: 'https://via.placeholder.com/300x200?text=Cheese+Slices',
    cost: 120,
    description: 'Processed cheese slices for sandwiches and snacks.',
  },
  {
    name: 'Ghee 500ml',
    imageUrl: 'https://via.placeholder.com/300x200?text=Ghee',
    cost: 320,
    description: 'Pure cow ghee, 500 ml jar.',
  },
  {
    name: 'Yogurt Cup 400g',
    imageUrl: 'https://via.placeholder.com/300x200?text=Yogurt',
    cost: 68,
    description: 'Creamy yogurt cup, 400 gram.',
  },
];

const normalizeName = (value) => String(value || '').trim().toLowerCase();

async function seedDairyProducts() {
  if (!process.env.DB_URL) {
    throw new Error('DB_URL is not configured in server/.env');
  }

  await mongoose.connect(process.env.DB_URL);

  let createdCount = 0;
  let updatedCount = 0;

  for (const product of DAIRY_PRODUCTS) {
    const normalizedTargetName = normalizeName(product.name);
    const existingProduct = await shopItemsModel.findOne({
      category: 'dairy',
      name: { $in: [product.name] },
    });

    if (!existingProduct) {
      await shopItemsModel.create({
        name: [product.name],
        imageUrl: product.imageUrl,
        cost: Number(product.cost),
        description: product.description,
        quantity: DEFAULT_DAIRY_QUANTITY,
        category: 'dairy',
      });
      createdCount += 1;
      continue;
    }

    const updatedNames = Array.isArray(existingProduct.name) ? existingProduct.name : [existingProduct.name];
    const hasMatchingName = updatedNames.some((entry) => normalizeName(entry) === normalizedTargetName);

    await shopItemsModel.updateOne(
      { _id: existingProduct._id },
      {
        $set: {
          imageUrl: product.imageUrl,
          cost: Number(product.cost),
          description: product.description,
          category: 'dairy',
        },
        ...(hasMatchingName ? {} : { $addToSet: { name: product.name } }),
        ...(Number(existingProduct.quantity || 0) > 0
          ? {}
          : { $setOnInsert: { quantity: DEFAULT_DAIRY_QUANTITY } }),
      },
      { upsert: false },
    );

    if (Number(existingProduct.quantity || 0) <= 0) {
      await shopItemsModel.updateOne(
        { _id: existingProduct._id },
        { $set: { quantity: DEFAULT_DAIRY_QUANTITY } },
      );
    }

    updatedCount += 1;
  }

  console.log(`Dairy seed complete. Created: ${createdCount}, Updated: ${updatedCount}`);
}

seedDairyProducts()
  .catch((error) => {
    console.error('Failed to seed dairy products:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // ignore disconnect failures in script mode
    }
  });
