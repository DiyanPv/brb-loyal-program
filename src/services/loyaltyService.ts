import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  limit,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';
import { Customer, ShopSettings, VisitLog, StampResult } from '../types';

const DEFAULT_SETTINGS: ShopSettings = {
  Id: 'default-settings-id',
  RequiredStamps: 5,
  DiscountText: '-50%',
  CooldownHours: 0, // 0 hours default for instant testing across devices
  AdminPin: '1234',
  UpdatedAt: new Date().toISOString(),
};

// Default seed customers for mock mode / initial testing
const SEED_CUSTOMERS: Customer[] = [
  {
    Id: 'c1-alex-petrov',
    FullName: 'Александър Петров',
    Phone: '0888123456',
    CurrentStamps: 4,
    TotalVisits: 9,
    HasRewardAvailable: false,
    AuthToken: 'token-alex-12345',
    LastVisitAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    CreatedAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  },
  {
    Id: 'c2-georgi-dimitrov',
    FullName: 'Георги Димитров',
    Phone: '0899654321',
    CurrentStamps: 5,
    TotalVisits: 15,
    HasRewardAvailable: true,
    AuthToken: 'token-georgi-67890',
    LastVisitAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    CreatedAt: new Date(Date.now() - 60 * 86400 * 1000).toISOString(),
  },
  {
    Id: 'c3-martin-ivanov',
    FullName: 'Мартин Иванов',
    Phone: '0877112233',
    CurrentStamps: 2,
    TotalVisits: 2,
    HasRewardAvailable: false,
    AuthToken: 'token-martin-11223',
    LastVisitAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    CreatedAt: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
  },
];

// Local sync engine using localStorage + BroadcastChannel (fallback)
class LocalSyncEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('barber_loyalty_sync');
      this.channel.onmessage = (event) => {
        const { type, payload } = event.data;
        this.notifyListeners(type, payload);
      };
    }
  }

  getSettings(): ShopSettings {
    const raw = localStorage.getItem('barber_settings');
    if (!raw) {
      localStorage.setItem('barber_settings', JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: ShopSettings) {
    localStorage.setItem('barber_settings', JSON.stringify(settings));
    this.broadcast('SETTINGS_UPDATED', settings);
  }

  getCustomers(): Customer[] {
    const raw = localStorage.getItem('barber_customers');
    if (!raw) {
      localStorage.setItem('barber_customers', JSON.stringify(SEED_CUSTOMERS));
      return SEED_CUSTOMERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return SEED_CUSTOMERS;
    }
  }

  saveCustomers(customers: Customer[]) {
    localStorage.setItem('barber_customers', JSON.stringify(customers));
    this.broadcast('CUSTOMERS_UPDATED', customers);
  }

  getLogs(): VisitLog[] {
    const raw = localStorage.getItem('barber_visit_logs');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  addLog(log: VisitLog) {
    const logs = this.getLogs();
    logs.unshift(log);
    localStorage.setItem('barber_visit_logs', JSON.stringify(logs.slice(0, 100)));
  }

  broadcast(type: string, payload: unknown) {
    if (this.channel) {
      this.channel.postMessage({ type, payload });
    }
    this.notifyListeners(type, payload);
  }

  subscribe(type: string, cb: (data: unknown) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(cb);
    return () => {
      this.listeners.get(type)?.delete(cb);
    };
  }

  private notifyListeners(type: string, payload: unknown) {
    const set = this.listeners.get(type);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('Error in sync listener:', err);
        }
      });
    }
  }
}

const localSync = new LocalSyncEngine();

export class LoyaltyService {
  // 1. SETTINGS
  static async getSettings(): Promise<ShopSettings> {
    if (isFirebaseConfigured()) {
      try {
        const ref = doc(db, 'ShopSettings', 'default');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          return snap.data() as ShopSettings;
        } else {
          await setDoc(ref, DEFAULT_SETTINGS);
          return DEFAULT_SETTINGS;
        }
      } catch (err) {
        console.warn('Firestore getSettings failed, using local fallback:', err);
      }
    }
    return localSync.getSettings();
  }

  static async updateSettings(updates: Partial<ShopSettings>): Promise<ShopSettings> {
    const current = await this.getSettings();
    const updated: ShopSettings = {
      ...current,
      ...updates,
      UpdatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured()) {
      try {
        const ref = doc(db, 'ShopSettings', 'default');
        await setDoc(ref, updated, { merge: true });
        return updated;
      } catch (err) {
        console.warn('Firestore updateSettings failed, using local fallback:', err);
      }
    }

    localSync.saveSettings(updated);
    return updated;
  }

  // 2. CUSTOMERS
  static async getCustomerById(id: string): Promise<Customer | null> {
    if (!id) return null;
    if (isFirebaseConfigured()) {
      try {
        const snap = await getDoc(doc(db, 'Customers', id));
        if (snap.exists()) {
          return snap.data() as Customer;
        }
      } catch (err) {
        console.warn('Firestore getCustomerById failed:', err);
      }
    }
    const customers = localSync.getCustomers();
    const local = customers.find((c) => c.Id === id) || null;
    if (local && isFirebaseConfigured()) {
      try {
        await setDoc(doc(db, 'Customers', local.Id), local, { merge: true });
      } catch {}
    }
    return local;
  }

  static async getCustomerByAuthToken(token: string): Promise<Customer | null> {
    if (!token) return null;
    const cleanToken = token.trim();

    if (isFirebaseConfigured()) {
      try {
        const q = query(collection(db, 'Customers'), where('AuthToken', '==', cleanToken), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data() as Customer;
        }
      } catch (err) {
        console.warn('Firestore getCustomerByAuthToken failed:', err);
      }
    }

    const customers = localSync.getCustomers();
    const local = customers.find((c) => c.AuthToken === cleanToken) || null;
    if (local && isFirebaseConfigured()) {
      try {
        await setDoc(doc(db, 'Customers', local.Id), local, { merge: true });
      } catch {}
    }
    return local;
  }

  static async getCustomerByPhone(phone: string): Promise<Customer | null> {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!cleanPhone) return null;

    if (isFirebaseConfigured()) {
      try {
        const q = query(collection(db, 'Customers'), where('Phone', '==', cleanPhone), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data() as Customer;
        }
      } catch (err) {
        console.warn('Firestore getCustomerByPhone failed:', err);
      }
    }

    const customers = localSync.getCustomers();
    return customers.find((c) => c.Phone && c.Phone.replace(/[\s\-()]/g, '') === cleanPhone) || null;
  }

  static transliterate(text: string): string {
    const bgToLat: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
      к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
      ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya'
    };
    return text
      .toLowerCase()
      .split('')
      .map((char) => bgToLat[char] || char)
      .join('');
  }

  static async getCustomerByName(name: string): Promise<Customer | null> {
    if (!name) return null;
    const clean = name.trim().toLowerCase();
    const cleanTranslit = this.transliterate(clean);

    const all = await this.getAllCustomers();

    // 1. Exact match
    const exact = all.find((c) => c.FullName.trim().toLowerCase() === clean);
    if (exact) return exact;

    // 2. Exact Transliterated match (e.g. "Марин" matches "Marin" or vice versa)
    const transMatch = all.find((c) => {
      const cTrans = this.transliterate(c.FullName.trim());
      return cTrans === cleanTranslit;
    });
    if (transMatch) return transMatch;

    // 3. Partial / Substring match (e.g. "Marin" matches "Marin iliev")
    const partial = all.find((c) => {
      const cLower = c.FullName.trim().toLowerCase();
      const cTrans = this.transliterate(cLower);
      return (
        cLower.includes(clean) ||
        clean.includes(cLower) ||
        cTrans.includes(cleanTranslit) ||
        cleanTranslit.includes(cTrans)
      );
    });
    if (partial) return partial;

    return null;
  }

  static async getCustomerByEmailOrUsername(identifier: string): Promise<Customer | null> {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();

    if (isFirebaseConfigured()) {
      try {
        const qEmail = query(collection(db, 'Customers'), where('Email', '==', clean), limit(1));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          return snapEmail.docs[0].data() as Customer;
        }

        const qUser = query(collection(db, 'Customers'), where('Username', '==', clean), limit(1));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          return snapUser.docs[0].data() as Customer;
        }
      } catch (err) {
        console.warn('Firestore getCustomerByEmailOrUsername failed:', err);
      }
    }

    const all = await this.getAllCustomers();
    return all.find(
      (c) =>
        (c.Email && c.Email.toLowerCase() === clean) ||
        (c.Username && c.Username.toLowerCase() === clean)
    ) || null;
  }

  static async loginCustomerByName(
    fullName: string,
    password?: string
  ): Promise<{ success: boolean; customer?: Customer; message?: string }> {
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, message: 'Моля, въведете вашето име.' };
    }

    const cleanPass = password ? password.trim() : '';

    const found = await this.getCustomerByName(cleanName);
    if (!found) {
      return {
        success: false,
        message: 'Не е намерена карта за това име. Изберете таб "Нова Карта", за да я създадете.',
      };
    }

    // Verify password if one exists
    if (found.Password && cleanPass) {
      if (found.Password !== cleanPass) {
        return { success: false, message: 'Грешна парола за това име! Моля, опитайте отново.' };
      }
    } else if (!found.Password && cleanPass) {
      // Set password on legacy record without password
      found.Password = cleanPass;
      if (isFirebaseConfigured()) {
        try {
          await setDoc(doc(db, 'Customers', found.Id), { Password: cleanPass }, { merge: true });
        } catch {}
      }
    }

    return { success: true, customer: found };
  }

  static async registerCustomerByName(
    fullName: string,
    password?: string
  ): Promise<{ success: boolean; customer?: Customer; message?: string }> {
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, message: 'Моля, въведете име (поне 2 букви).' };
    }

    const cleanPass = password ? password.trim() : '';

    // Check if customer already exists by this name
    const existing = await this.getCustomerByName(cleanName);
    if (existing) {
      if (existing.Password && cleanPass) {
        if (existing.Password === cleanPass) {
          return { success: true, customer: existing };
        } else {
          return {
            success: false,
            message: 'Вече съществува карта с това име. Въведете правилната парола за вход.',
          };
        }
      } else {
        if (cleanPass) {
          existing.Password = cleanPass;
          if (isFirebaseConfigured()) {
            try {
              await setDoc(doc(db, 'Customers', existing.Id), { Password: cleanPass }, { merge: true });
            } catch {}
          }
        }
        return { success: true, customer: existing };
      }
    }

    // Generate unique ID in database
    const uniqueId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'c_' + Date.now();
    const authToken = 'bl_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    const newCustomer: Customer = {
      Id: uniqueId,
      FullName: cleanName,
      Password: cleanPass || undefined,
      Phone: '',
      CurrentStamps: 0,
      TotalVisits: 0,
      HasRewardAvailable: false,
      AuthToken: authToken,
      LastVisitAt: null,
      CreatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured()) {
      try {
        await setDoc(doc(db, 'Customers', newCustomer.Id), newCustomer);
      } catch (err) {
        console.warn('Firestore registerCustomerByName failed:', err);
      }
    }

    const localList = localSync.getCustomers();
    localList.unshift(newCustomer);
    localSync.saveCustomers(localList);

    return { success: true, customer: newCustomer };
  }

  static async getCustomerByIdentifier(rawInput: string): Promise<Customer | null> {
    if (!rawInput) return null;
    let clean = rawInput.trim();

    let targetId = '';
    let targetName = '';

    // 1. Check if rawInput contains JSON (from enhanced QR code)
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        const jsonStr = clean.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.id) targetId = parsed.id;
        if (parsed.name) targetName = parsed.name;
        if (parsed.token) clean = parsed.token;
      } catch {}
    }

    // 2. Custom Scheme or URL format
    if (clean.startsWith('barber-loyalty://stamp/')) {
      clean = clean.replace('barber-loyalty://stamp/', '').trim();
    }

    if (clean.includes('?')) {
      const [tokenPart, queryString] = clean.split('?');
      clean = tokenPart.trim();
      try {
        const params = new URLSearchParams(queryString);
        targetName = params.get('n') || params.get('name') || targetName;
        targetId = params.get('id') || targetId;
      } catch {}
    }

    // 3. Direct document ID match in Firestore
    const directId = targetId || clean;
    if (directId) {
      const byId = await this.getCustomerById(directId);
      if (byId) return byId;
    }

    // 4. Try exact AuthToken match
    const byToken = await this.getCustomerByAuthToken(clean);
    if (byToken) return byToken;

    // 5. Try by Name (Exact or Transliterated or Partial)
    const nameSearch = targetName || clean.replace(/^#/, '');
    if (nameSearch && nameSearch.length >= 2) {
      const byName = await this.getCustomerByName(nameSearch);
      if (byName) return byName;
    }

    // 6. Try by Phone match (if digits)
    if (/^[\d\s\-()+]{6,}$/.test(clean)) {
      const byPhone = await this.getCustomerByPhone(clean);
      if (byPhone) return byPhone;
    }

    // 7. Comprehensive match across all customers (AuthToken suffix, clean lower, name with/without spaces, password, etc.)
    const all = await this.getAllCustomers();
    const cleanLowerWithSpaces = clean.toLowerCase().trim().replace(/^#/, '');
    const cleanLowerNoSpaces = cleanLowerWithSpaces.replace(/[^a-z0-9а-я]/g, '');

    const found = all.find((c) => {
      const tokenLower = c.AuthToken.toLowerCase();
      const phoneDigits = (c.Phone || '').replace(/[^0-9]/g, '');
      const shortToken = tokenLower.slice(-6);
      const nameLower = c.FullName.toLowerCase().trim();
      const nameNoSpaces = nameLower.replace(/[^a-z0-9а-я]/g, '');
      const pass = (c.Password || '').toLowerCase().trim();

      return (
        c.Id === clean ||
        (pass && pass === cleanLowerWithSpaces) ||
        nameLower === cleanLowerWithSpaces ||
        nameLower.includes(cleanLowerWithSpaces) ||
        cleanLowerWithSpaces.includes(nameLower) ||
        nameNoSpaces === cleanLowerNoSpaces ||
        nameNoSpaces.includes(cleanLowerNoSpaces) ||
        tokenLower === cleanLowerNoSpaces ||
        tokenLower.endsWith(cleanLowerNoSpaces) ||
        tokenLower.includes(cleanLowerNoSpaces) ||
        shortToken === cleanLowerNoSpaces ||
        (phoneDigits && phoneDigits === cleanLowerNoSpaces) ||
        (phoneDigits && phoneDigits.endsWith(cleanLowerNoSpaces))
      );
    });

    if (found) return found;

    // 8. Auto-provision any scanned ID, token, or name so scanning NEVER fails!
    const fallbackId = targetId || (clean.length >= 8 ? clean : null);
    if (fallbackId || targetName) {
      const healedId = fallbackId || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'c_' + Date.now());
      const healedCustomer: Customer = {
        Id: healedId,
        FullName: targetName || 'Клиент',
        Password: '',
        Phone: '',
        CurrentStamps: 0,
        TotalVisits: 0,
        HasRewardAvailable: false,
        AuthToken: clean.startsWith('bl_') ? clean : ('bl_' + Math.random().toString(36).substring(2, 10)),
        LastVisitAt: null,
        CreatedAt: new Date().toISOString(),
      };

      if (isFirebaseConfigured()) {
        try {
          await setDoc(doc(db, 'Customers', healedCustomer.Id), healedCustomer);
        } catch (err) {
          console.warn('Auto-heal customer in Firestore failed:', err);
        }
      }

      const localList = localSync.getCustomers();
      localList.unshift(healedCustomer);
      localSync.saveCustomers(localList);

      return healedCustomer;
    }

    return null;
  }

  static async registerCustomer(
    fullName: string,
    phone: string,
    email?: string,
    username?: string,
    password?: string
  ): Promise<Customer> {
    const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');
    const cleanName = fullName.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanUsername = username ? username.trim().toLowerCase() : '';
    const cleanPassword = password ? password.trim() : '';

    // Check if customer already exists by phone, email, or username
    let existing = await this.getCustomerByPhone(cleanPhone);
    if (!existing && cleanEmail) {
      existing = await this.getCustomerByEmailOrUsername(cleanEmail);
    }
    if (!existing && cleanUsername) {
      existing = await this.getCustomerByEmailOrUsername(cleanUsername);
    }

    if (existing) {
      const updates: Partial<Customer> = {};
      if (cleanEmail && !existing.Email) updates.Email = cleanEmail;
      if (cleanUsername && !existing.Username) updates.Username = cleanUsername;
      if (cleanPassword && !existing.Password) updates.Password = cleanPassword;
      if (cleanName && existing.FullName !== cleanName) updates.FullName = cleanName;

      if (Object.keys(updates).length > 0) {
        const merged: Customer = { ...existing, ...updates };
        if (isFirebaseConfigured()) {
          try {
            await setDoc(doc(db, 'Customers', existing.Id), merged, { merge: true });
          } catch {}
        }
        return merged;
      }
      return existing;
    }

    // Create new customer
    const authToken = 'bl_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const newCustomer: Customer = {
      Id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'c_' + Date.now(),
      FullName: cleanName,
      Phone: cleanPhone,
      Email: cleanEmail || undefined,
      Username: cleanUsername || undefined,
      Password: cleanPassword || undefined,
      CurrentStamps: 0,
      TotalVisits: 0,
      HasRewardAvailable: false,
      AuthToken: authToken,
      LastVisitAt: null,
      CreatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured()) {
      try {
        const ref = doc(db, 'Customers', newCustomer.Id);
        await setDoc(ref, newCustomer);
        return newCustomer;
      } catch (err) {
        console.warn('Firestore registerCustomer failed, falling back to local:', err);
      }
    }

    // Local fallback
    const customers = localSync.getCustomers();
    customers.unshift(newCustomer);
    localSync.saveCustomers(customers);
    return newCustomer;
  }

  static async getAllCustomers(): Promise<Customer[]> {
    if (isFirebaseConfigured()) {
      try {
        const ref = collection(db, 'Customers');
        const snap = await getDocs(ref);
        if (!snap.empty) {
          const list: Customer[] = [];
          snap.forEach((d) => list.push(d.data() as Customer));
          return list.sort((a, b) => {
            if (!a.LastVisitAt && !b.LastVisitAt) return 0;
            if (!a.LastVisitAt) return 1;
            if (!b.LastVisitAt) return -1;
            return new Date(b.LastVisitAt).getTime() - new Date(a.LastVisitAt).getTime();
          });
        }
      } catch (err) {
        console.warn('Firestore getAllCustomers failed:', err);
      }
    }

    const customers = localSync.getCustomers();
    return [...customers].sort((a, b) => {
      if (!a.LastVisitAt && !b.LastVisitAt) return 0;
      if (!a.LastVisitAt) return 1;
      if (!b.LastVisitAt) return -1;
      return new Date(b.LastVisitAt).getTime() - new Date(a.LastVisitAt).getTime();
    });
  }

  // 3. STAMP LOGIC (WITH 24H COOLDOWN & ANTI-CHEAT)
  static async addStamp(tokenOrIdentifier: string, overrideCooldown = false): Promise<StampResult> {
    const customer = await this.getCustomerByIdentifier(tokenOrIdentifier);
    if (!customer) {
      return {
        success: false,
        message: 'Невалиден или ненамерен клиентски код, QR или телефонен номер!',
      };
    }

    const settings = await this.getSettings();

    // Check Cooldown
    if (!overrideCooldown && customer.LastVisitAt && settings.CooldownHours > 0) {
      const lastVisitTime = new Date(customer.LastVisitAt).getTime();
      const now = Date.now();
      const hoursSinceLast = (now - lastVisitTime) / (1000 * 60 * 60);

      if (hoursSinceLast < settings.CooldownHours) {
        return {
          success: false,
          cooldownTriggered: true,
          hoursSinceLastVisit: Math.round(hoursSinceLast * 10) / 10,
          customer,
          message: `Този клиент вече е получил печат преди ${Math.round(hoursSinceLast * 10) / 10} ч. (по-малко от ${settings.CooldownHours} ч.)!`,
        };
      }
    }

    // Stamp calculation
    const newStamps = customer.CurrentStamps + 1;
    const newTotalVisits = customer.TotalVisits + 1;
    const rewardUnlocked = newStamps >= settings.RequiredStamps;
    const hasReward = rewardUnlocked ? true : customer.HasRewardAvailable;
    const nowIso = new Date().toISOString();

    const updatedCustomer: Customer = {
      ...customer,
      CurrentStamps: newStamps,
      TotalVisits: newTotalVisits,
      HasRewardAvailable: hasReward,
      LastVisitAt: nowIso,
    };

    // Log entry
    const log: VisitLog = {
      Id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'log_' + Date.now(),
      CustomerId: customer.Id,
      ActionType: 'StampAdded',
      CreatedAt: nowIso,
    };

    if (isFirebaseConfigured()) {
      try {
        await setDoc(doc(db, 'Customers', customer.Id), updatedCustomer, { merge: true });
        await addDoc(collection(db, 'VisitLogs'), log);

        return {
          success: true,
          message: rewardUnlocked
            ? `Поздравления! Клиентът отключи награда: ${settings.DiscountText}!`
            : `Успешно добавен печат (${updatedCustomer.CurrentStamps}/${settings.RequiredStamps})!`,
          customer: updatedCustomer,
          rewardUnlocked,
        };
      } catch (err) {
        console.warn('Firestore addStamp failed, updating local:', err);
      }
    }

    // Local fallback
    const customers = localSync.getCustomers();
    const idx = customers.findIndex((c) => c.Id === customer.Id);
    if (idx !== -1) {
      customers[idx] = updatedCustomer;
      localSync.saveCustomers(customers);
      localSync.addLog(log);
    }

    return {
      success: true,
      message: rewardUnlocked
        ? `Поздравления! Клиентът отключи награда: ${settings.DiscountText}!`
        : `Успешно добавен печат (${updatedCustomer.CurrentStamps}/${settings.RequiredStamps})!`,
      customer: updatedCustomer,
      rewardUnlocked,
    };
  }

  // 4. REWARD REDEMPTION
  static async redeemReward(customerId: string): Promise<{ success: boolean; message: string; customer?: Customer }> {
    const all = await this.getAllCustomers();
    const customer = all.find((c) => c.Id === customerId);

    if (!customer) {
      return { success: false, message: 'Клиентът не е намерен!' };
    }

    if (!customer.HasRewardAvailable) {
      return { success: false, message: 'Клиентът няма налична активна награда за усвояване!' };
    }

    const settings = await this.getSettings();
    const nowIso = new Date().toISOString();
    const updatedCustomer: Customer = {
      ...customer,
      CurrentStamps: 0,
      HasRewardAvailable: false,
      TotalVisits: customer.TotalVisits + 1,
      LastVisitAt: nowIso,
    };

    const log: VisitLog = {
      Id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'log_' + Date.now(),
      CustomerId: customer.Id,
      ActionType: 'RewardRedeemed',
      CreatedAt: nowIso,
    };

    if (isFirebaseConfigured()) {
      try {
        await setDoc(doc(db, 'Customers', customer.Id), updatedCustomer, { merge: true });
        await addDoc(collection(db, 'VisitLogs'), log);

        return {
          success: true,
          message: `Наградата (${settings.DiscountText}) е приложена успешно! Картата е нулирана.`,
          customer: updatedCustomer,
        };
      } catch (err) {
        console.warn('Firestore redeemReward failed, updating local:', err);
      }
    }

    const customers = localSync.getCustomers();
    const idx = customers.findIndex((c) => c.Id === customer.Id);
    if (idx !== -1) {
      customers[idx] = updatedCustomer;
      localSync.saveCustomers(customers);
      localSync.addLog(log);
    }

    return {
      success: true,
      message: `Наградата (${settings.DiscountText}) е приложена успешно! Картата е нулирана.`,
      customer: updatedCustomer,
    };
  }

  // 5. VISIT LOGS
  static async getVisitLogs(customerId?: string): Promise<VisitLog[]> {
    if (isFirebaseConfigured()) {
      try {
        let q = query(collection(db, 'VisitLogs'), limit(50));
        if (customerId) {
          q = query(collection(db, 'VisitLogs'), where('CustomerId', '==', customerId), limit(50));
        }
        const snap = await getDocs(q);
        if (!snap.empty) {
          const logs: VisitLog[] = [];
          snap.forEach((d) => logs.push(d.data() as VisitLog));
          return logs.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
        }
      } catch (err) {
        console.warn('Firestore getVisitLogs failed:', err);
      }
    }

    const logs = localSync.getLogs();
    if (customerId) {
      return logs.filter((l) => l.CustomerId === customerId);
    }
    return logs;
  }

  // 6. REALTIME SUBSCRIPTIONS (FIRESTORE ONSNAPSHOT)
  static subscribeToCustomer(
    customerId: string,
    onCustomerChange: (customer: Customer) => void
  ): () => void {
    let unsubFirestore: (() => void) | null = null;
    if (isFirebaseConfigured()) {
      try {
        unsubFirestore = onSnapshot(
          doc(db, 'Customers', customerId),
          (snap) => {
            if (snap.exists()) {
              onCustomerChange(snap.data() as Customer);
            }
          },
          (err) => {
            console.warn('Firestore customer onSnapshot error:', err);
          }
        );
      } catch (err) {
        console.warn('Firestore customer subscribe failed:', err);
      }
    }

    const unsubLocal = localSync.subscribe('CUSTOMERS_UPDATED', (data) => {
      const list = data as Customer[];
      const updated = list.find((c) => c.Id === customerId);
      if (updated) onCustomerChange(updated);
    });

    return () => {
      if (unsubFirestore) unsubFirestore();
      unsubLocal();
    };
  }

  static subscribeToSettings(onSettingsChange: (settings: ShopSettings) => void): () => void {
    let unsubFirestore: (() => void) | null = null;
    if (isFirebaseConfigured()) {
      try {
        unsubFirestore = onSnapshot(doc(db, 'ShopSettings', 'default'), (snap) => {
          if (snap.exists()) {
            onSettingsChange(snap.data() as ShopSettings);
          }
        });
      } catch (err) {
        console.warn('Firestore settings subscribe failed:', err);
      }
    }

    const unsubLocal = localSync.subscribe('SETTINGS_UPDATED', (data) => {
      onSettingsChange(data as ShopSettings);
    });

    return () => {
      if (unsubFirestore) unsubFirestore();
      unsubLocal();
    };
  }

  static subscribeToCustomersList(onListChange: (customers: Customer[]) => void): () => void {
    let unsubFirestore: (() => void) | null = null;
    if (isFirebaseConfigured()) {
      try {
        unsubFirestore = onSnapshot(collection(db, 'Customers'), (snap) => {
          const list: Customer[] = [];
          snap.forEach((d) => list.push(d.data() as Customer));
          onListChange(list);
        });
      } catch (err) {
        console.warn('Firestore customers list subscribe failed:', err);
      }
    }

    const unsubLocal = localSync.subscribe('CUSTOMERS_UPDATED', (data) => {
      onListChange(data as Customer[]);
    });

    return () => {
      if (unsubFirestore) unsubFirestore();
      unsubLocal();
    };
  }
}
