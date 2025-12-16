import { Category, type CategoryAttrs, type CategoryDoc } from '../models/category.model.js';

const list = async (): Promise<CategoryDoc[]> => {
  return Category.find().sort({ order: 1, label: 1 }).exec();
};

const getBySlug = async (slug: string): Promise<CategoryDoc | null> => {
  return Category.findOne({ slug: slug.toLowerCase() }).exec();
};

const create = async (payload: CategoryAttrs): Promise<CategoryDoc> => {
  const category = new Category({
    ...payload,
    slug: payload.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  });
  return category.save();
};

const update = async (slug: string, payload: Partial<CategoryAttrs>): Promise<CategoryDoc | null> => {
  const updateData: Partial<CategoryAttrs> = { ...payload };
  if (payload.slug) {
    updateData.slug = payload.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
  return Category.findOneAndUpdate({ slug }, updateData, { new: true }).exec();
};

const remove = async (slug: string): Promise<boolean> => {
  const result = await Category.deleteOne({ slug }).exec();
  return result.deletedCount > 0;
};

// Seed default categories if none exist
const seedDefaults = async (): Promise<void> => {
  const count = await Category.countDocuments().exec();
  if (count === 0) {
    const defaults: CategoryAttrs[] = [
      { slug: 'uncut', label: 'Uncut', order: 1 },
      { slug: 'solo', label: 'Solo', order: 2 },
      { slug: 'duo', label: 'Duo', order: 3 },
      { slug: 'bts', label: 'Behind the Scenes', order: 4 },
      { slug: 'compilation', label: 'Compilation', order: 5 }
    ];
    await Category.insertMany(defaults);
    console.log('✓ Default categories seeded');
  }
};

export const categoryService = {
  list,
  getBySlug,
  create,
  update,
  remove,
  seedDefaults
};
