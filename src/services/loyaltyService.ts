import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Customer, ShopSettings, VisitLog, StampResult } from '../types';

const DEFAULT_SETTINGS: ShopSettings = {
  Id: 'default-settings-id',
  RequiredStamps: 5,
  DiscountText: '-50%',
  CooldownHours: 24,
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
    LastVisitAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(), // 26 hours ago
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
    LastVisitAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
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

// Local sync engine using localStorage + BroadcastChannel
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
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('ShopSettings')
          .select('*')
          .order('UpdatedAt', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return data as ShopSettings;
        }

        // If table is empty, create default
        if (!error && !data) {
          const { data: inserted } = await supabase
            .from('ShopSettings')
            .insert([DEFAULT_SETTINGS])
            .select()
            .single();
          if (inserted) return inserted as ShopSettings;
        }
      } catch (err) {
        console.warn('Failed to fetch settings from Supabase, using local fallback:', err);
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

    const oldRequired = current.RequiredStamps;
    const newRequired = updated.RequiredStamps;

    // Supabase update
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('ShopSettings')
          .update(updated)
          .eq('Id', current.Id);

        // Stamp threshold adjustments
        if (newRequired < oldRequired) {
          // Reduced threshold: any customer with stamps >= newRequired gets reward activated and stamps capped
          const { data: affectedCustomers } = await supabase
            .from('Customers')
            .select('*')
            .gte('CurrentStamps', newRequired);

          if (affectedCustomers && affectedCustomers.length > 0) {
            for (const c of affectedCustomers) {
              await supabase
                .from('Customers')
                .update({
                  HasRewardAvailable: true,
                  CurrentStamps: newRequired,
                })
                .eq('Id', c.Id);
            }
          }
        }
        return updated;
      } catch (err) {
        console.warn('Error updating Supabase settings:', err);
      }
    }

    // Local fallback update
    localSync.saveSettings(updated);

    // Local threshold logic
    if (newRequired < oldRequired) {
      const customers = localSync.getCustomers();
      let changed = false;
      const modified = customers.map((c) => {
        if (c.CurrentStamps >= newRequired) {
          changed = true;
          return {
            ...c,
            HasRewardAvailable: true,
            CurrentStamps: newRequired,
          };
        }
        return c;
      });
      if (changed) {
        localSync.saveCustomers(modified);
      }
    }

    return updated;
  }

  // 2. CUSTOMERS
  static async getCustomerByAuthToken(token: string): Promise<Customer | null> {
    if (!token) return null;
    const cleanToken = token.trim();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('Customers')
          .select('*')
          .eq('AuthToken', cleanToken)
          .maybeSingle();

        if (!error && data) {
          return data as Customer;
        }
      } catch (err) {
        console.warn('Supabase fetch customer by token failed:', err);
      }
    }

    const customers = localSync.getCustomers();
    return customers.find((c) => c.AuthToken === cleanToken) || null;
  }

  static async getCustomerByPhone(phone: string): Promise<Customer | null> {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[\s\-()]/g, '');

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('Customers')
          .select('*')
          .eq('Phone', cleanPhone)
          .maybeSingle();

        if (!error && data) {
          return data as Customer;
        }
      } catch (err) {
        console.warn('Supabase fetch customer by phone failed:', err);
      }
    }

    const customers = localSync.getCustomers();
    return customers.find((c) => c.Phone.replace(/[\s\-()]/g, '') === cleanPhone) || null;
  }

  /**
   * Universal customer resolver:
   * Supports raw AuthToken, QR uri (barber-loyalty://stamp/...), phone number,
   * or last 6 alphanumeric characters of code/phone for manual admin typing!
   */
  static async getCustomerByIdentifier(identifier: string): Promise<Customer | null> {
    if (!identifier) return null;
    let clean = identifier.trim();
    if (clean.startsWith('barber-loyalty://stamp/')) {
      clean = clean.replace('barber-loyalty://stamp/', '').trim();
    }

    // 1. Try exact AuthToken match
    const byToken = await this.getCustomerByAuthToken(clean);
    if (byToken) return byToken;

    // 2. Try normalized Phone match
    const byPhone = await this.getCustomerByPhone(clean);
    if (byPhone) return byPhone;

    // 3. Try matching by short code (case-insensitive substring of AuthToken or Phone)
    const all = await this.getAllCustomers();
    const cleanLower = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

    const found = all.find((c) => {
      const tokenLower = c.AuthToken.toLowerCase();
      const phoneDigits = c.Phone.replace(/[^0-9]/g, '');
      const shortToken = tokenLower.slice(-6);

      return (
        tokenLower === cleanLower ||
        tokenLower.endsWith(cleanLower) ||
        shortToken === cleanLower ||
        phoneDigits === cleanLower ||
        phoneDigits.endsWith(cleanLower) ||
        c.Id === clean
      );
    });

    return found || null;
  }

  static async registerCustomer(fullName: string, phone: string): Promise<Customer> {
    const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');
    const cleanName = fullName.trim();

    // Check if customer already exists by phone
    const existing = await this.getCustomerByPhone(cleanPhone);
    if (existing) {
      return existing;
    }

    // Create new customer
    const authToken = 'bl_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const newCustomer: Customer = {
      Id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'c_' + Date.now(),
      FullName: cleanName,
      Phone: cleanPhone,
      CurrentStamps: 0,
      TotalVisits: 0,
      HasRewardAvailable: false,
      AuthToken: authToken,
      LastVisitAt: null,
      CreatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('Customers')
          .insert([newCustomer])
          .select()
          .single();

        if (!error && data) {
          return data as Customer;
        }
      } catch (err) {
        console.warn('Failed to insert customer to Supabase:', err);
      }
    }

    // Local fallback
    const customers = localSync.getCustomers();
    customers.unshift(newCustomer);
    localSync.saveCustomers(customers);
    return newCustomer;
  }

  static async getAllCustomers(): Promise<Customer[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('Customers')
          .select('*')
          .order('LastVisitAt', { ascending: false, nullsFirst: false });

        if (!error && data) {
          return data as Customer[];
        }
      } catch (err) {
        console.warn('Failed to get all customers from Supabase:', err);
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

    // Write to Supabase if available
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('Customers')
          .update({
            CurrentStamps: updatedCustomer.CurrentStamps,
            TotalVisits: updatedCustomer.TotalVisits,
            HasRewardAvailable: updatedCustomer.HasRewardAvailable,
            LastVisitAt: updatedCustomer.LastVisitAt,
          })
          .eq('Id', customer.Id);

        await supabase.from('VisitLogs').insert([log]);

        return {
          success: true,
          message: rewardUnlocked
            ? `Поздравления! Клиентът отключи награда: ${settings.DiscountText}!`
            : `Успешно добавен печат (${updatedCustomer.CurrentStamps}/${settings.RequiredStamps})!`,
          customer: updatedCustomer,
          rewardUnlocked,
        };
      } catch (err) {
        console.warn('Failed to update customer in Supabase:', err);
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
    let customer: Customer | null = null;
    const settings = await this.getSettings();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase
          .from('Customers')
          .select('*')
          .eq('Id', customerId)
          .maybeSingle();
        if (data) customer = data as Customer;
      } catch (err) {
        console.warn('Error fetching customer for redeem:', err);
      }
    }

    if (!customer) {
      const customers = localSync.getCustomers();
      customer = customers.find((c) => c.Id === customerId) || null;
    }

    if (!customer) {
      return { success: false, message: 'Клиентът не е намерен!' };
    }

    if (!customer.HasRewardAvailable) {
      return { success: false, message: 'Клиентът няма налична активна награда за усвояване!' };
    }

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

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('Customers')
          .update({
            CurrentStamps: 0,
            HasRewardAvailable: false,
            TotalVisits: updatedCustomer.TotalVisits,
            LastVisitAt: updatedCustomer.LastVisitAt,
          })
          .eq('Id', customer.Id);

        await supabase.from('VisitLogs').insert([log]);

        return {
          success: true,
          message: `Наградата (${settings.DiscountText}) е приложена успешно! Картата е нулирана.`,
          customer: updatedCustomer,
        };
      } catch (err) {
        console.warn('Error redeeming reward in Supabase:', err);
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
      message: `Наградата (${settings.DiscountText}) е приложена успешно! Картата е нулирана.`,
      customer: updatedCustomer,
    };
  }

  // 5. VISIT LOGS
  static async getVisitLogs(customerId?: string): Promise<VisitLog[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('VisitLogs').select('*').order('CreatedAt', { ascending: false });
        if (customerId) {
          query = query.eq('CustomerId', customerId);
        }
        const { data, error } = await query.limit(50);
        if (!error && data) return data as VisitLog[];
      } catch (err) {
        console.warn('Failed to fetch visit logs from Supabase:', err);
      }
    }

    const logs = localSync.getLogs();
    if (customerId) {
      return logs.filter((l) => l.CustomerId === customerId);
    }
    return logs;
  }

  // 6. REALTIME SUBSCRIPTIONS
  static subscribeToCustomer(
    customerId: string,
    onCustomerChange: (customer: Customer) => void
  ): () => void {
    // 1. Supabase Realtime channel
    if (isSupabaseConfigured() && supabase) {
      const channelName = `customer-realtime-${customerId}-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Customers',
            filter: `Id=eq.${customerId}`,
          },
          (payload) => {
            if (payload.new && (payload.new as Customer).Id === customerId) {
              onCustomerChange(payload.new as Customer);
            }
          }
        )
        .subscribe();

      // Also listen to local sync in case user is testing across tabs
      const unsubsLocal = localSync.subscribe('CUSTOMERS_UPDATED', (data) => {
        const list = data as Customer[];
        const updated = list.find((c) => c.Id === customerId);
        if (updated) onCustomerChange(updated);
      });

      return () => {
        if (supabase) supabase.removeChannel(channel);
        unsubsLocal();
      };
    }

    // 2. Local Sync engine fallback
    const unsubs = localSync.subscribe('CUSTOMERS_UPDATED', (data) => {
      const list = data as Customer[];
      const updated = list.find((c) => c.Id === customerId);
      if (updated) onCustomerChange(updated);
    });

    return unsubs;
  }

  static subscribeToSettings(onSettingsChange: (settings: ShopSettings) => void): () => void {
    if (isSupabaseConfigured() && supabase) {
      const channel = supabase
        .channel(`settings-realtime-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ShopSettings',
          },
          (payload) => {
            if (payload.new) {
              onSettingsChange(payload.new as ShopSettings);
            }
          }
        )
        .subscribe();

      const unsubsLocal = localSync.subscribe('SETTINGS_UPDATED', (data) => {
        onSettingsChange(data as ShopSettings);
      });

      return () => {
        if (supabase) supabase.removeChannel(channel);
        unsubsLocal();
      };
    }

    return localSync.subscribe('SETTINGS_UPDATED', (data) => {
      onSettingsChange(data as ShopSettings);
    });
  }

  static subscribeToCustomersList(onListChange: (customers: Customer[]) => void): () => void {
    if (isSupabaseConfigured() && supabase) {
      const channel = supabase
        .channel(`customers-list-realtime-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Customers',
          },
          async () => {
            const list = await this.getAllCustomers();
            onListChange(list);
          }
        )
        .subscribe();

      const unsubsLocal = localSync.subscribe('CUSTOMERS_UPDATED', (data) => {
        onListChange(data as Customer[]);
      });

      return () => {
        if (supabase) supabase.removeChannel(channel);
        unsubsLocal();
      };
    }

    return localSync.subscribe('CUSTOMERS_UPDATED', (data) => {
      onListChange(data as Customer[]);
    });
  }
}
