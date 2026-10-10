import { isMongoConfigured, getDb } from './mongodb';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'spotdiary_db.json');

interface DbSchema {
  users: any[];
  saved_places: any[];
  visits: any[];
  collections: any[];
  places: any[];
  password_resets: any[];
  visit_photos: any[];
}

function ensureDataFile(): DbSchema {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {}
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData: DbSchema = {
      users: [],
      saved_places: [],
      visits: [],
      collections: [],
      places: [],
      password_resets: [],
      visit_photos: [],
    };
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    } catch {}
    return initialData;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      users: [],
      saved_places: [],
      visits: [],
      collections: [],
      places: [],
      password_resets: [],
      visit_photos: [],
      ...parsed,
    };
  } catch {
    return {
      users: [],
      saved_places: [],
      visits: [],
      collections: [],
      places: [],
      password_resets: [],
      visit_photos: [],
    };
  }
}

function saveDataFile(data: DbSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export class LocalCollectionAdapter {
  private collectionName: keyof DbSchema;

  constructor(collectionName: keyof DbSchema) {
    this.collectionName = collectionName;
  }

  async findOne(query: any) {
    const dbData = ensureDataFile();
    const items = dbData[this.collectionName] || [];
    return items.find(item => {
      return Object.keys(query).every(key => {
        if (key === '_id' && item._id) {
          return item._id.toString() === query._id.toString();
        }
        return item[key] === query[key];
      });
    }) || null;
  }

  async find(query: any = {}) {
    const dbData = ensureDataFile();
    let items = dbData[this.collectionName] || [];
    if (query && Object.keys(query).length > 0) {
      items = items.filter(item => {
        return Object.keys(query).every(key => {
          const qVal = query[key];
          if (qVal && typeof qVal === 'object' && '$in' in qVal && Array.isArray(qVal.$in)) {
            return qVal.$in.includes(item[key] || item.id || item.place_id);
          }
          if (qVal && typeof qVal === 'object' && '$gte' in qVal) {
            return item[key] >= qVal.$gte;
          }
          return item[key] === query[key];
        });
      });
    }

    return {
      sort: (sortObj: any) => ({
        toArray: async () => items
      }),
      toArray: async () => items
    };
  }

  async countDocuments(query: any = {}) {
    const res = await this.find(query);
    const items = await res.toArray();
    return items.length;
  }

  async insertOne(doc: any) {
    const dbData = ensureDataFile();
    const id = doc._id ? doc._id.toString() : `id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newDoc = { _id: id, ...doc };
    if (!dbData[this.collectionName]) {
      dbData[this.collectionName] = [];
    }
    dbData[this.collectionName].push(newDoc);
    saveDataFile(dbData);
    return { insertedId: id };
  }

  async updateOne(filter: any, update: any) {
    const dbData = ensureDataFile();
    const items = dbData[this.collectionName] || [];
    const index = items.findIndex(item => {
      return Object.keys(filter).every(key => {
        if (key === '_id' && item._id) {
          return item._id.toString() === filter._id.toString();
        }
        return item[key] === filter[key];
      });
    });

    if (index > -1) {
      if (update.$set) {
        dbData[this.collectionName][index] = {
          ...dbData[this.collectionName][index],
          ...update.$set,
        };
      }
      if (update.$addToSet) {
        Object.keys(update.$addToSet).forEach(key => {
          const val = update.$addToSet[key];
          const currentArr = dbData[this.collectionName][index][key] || [];
          if (!currentArr.includes(val)) {
            dbData[this.collectionName][index][key] = [...currentArr, val];
          }
        });
      }
      if (update.$pull) {
        Object.keys(update.$pull).forEach(key => {
          const val = update.$pull[key];
          const currentArr = dbData[this.collectionName][index][key] || [];
          dbData[this.collectionName][index][key] = currentArr.filter((item: any) => item !== val);
        });
      }
      saveDataFile(dbData);
      return { modifiedCount: 1 };
    }
    return { modifiedCount: 0 };
  }

  async deleteOne(filter: any) {
    const dbData = ensureDataFile();
    const items = dbData[this.collectionName] || [];
    const initialLen = items.length;
    const newItems = items.filter(item => {
      return !Object.keys(filter).every(key => {
        if (key === '_id' && item._id) {
          return item._id.toString() === filter._id.toString();
        }
        return item[key] === filter[key];
      });
    });

    if (newItems.length !== initialLen) {
      dbData[this.collectionName] = newItems;
      saveDataFile(dbData);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
}

export async function getCollection(
  name: 'users' | 'saved_places' | 'visits' | 'collections' | 'places' | 'password_resets' | 'visit_photos'
) {
  if (isMongoConfigured()) {
    try {
      const mongoDb = await getDb();
      return mongoDb.collection(name);
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Production database error: MongoDB connection failed (${err?.message || 'unreachable'}).`);
      }
      console.warn(`[DBAdapter] MongoDB connection failed in development, falling back to local file: ${err?.message}`);
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Production configuration error: MONGODB_URI is required in production.');
  }
  return new LocalCollectionAdapter(name) as any;
}
