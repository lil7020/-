const SUPABASE_URL = 'https://gfeoegvntxyfotvhklri.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rBqTlyxcWEa1lwumCvxLLQ_bnimmF06';

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.authToken = localStorage.getItem('supabaseToken');
    }

    async request(method, endpoint, data = null, params = {}) {
        const url = new URL(`${this.url}/rest/v1${endpoint}`);
        
        if (params) {
            Object.keys(params).forEach(key => {
                url.searchParams.append(key, params[key]);
            });
        }

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.key,
                'Authorization': this.authToken ? `Bearer ${this.authToken}` : `Bearer ${this.key}`
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url.toString(), options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || '请求失败');
            }
            
            return result;
        } catch (error) {
            console.error('Supabase请求失败:', error);
            throw error;
        }
    }

    async get(table, params = {}) {
        return this.request('GET', `/${table}`, null, params);
    }

    async insert(table, data) {
        return this.request('POST', `/${table}`, data);
    }

    async update(table, id, data) {
        return this.request('PATCH', `/${table}`, data, { id: `eq.${id}` });
    }

    async delete(table, id) {
        return this.request('DELETE', `/${table}`, null, { id: `eq.${id}` });
    }

    setAuthToken(token) {
        this.authToken = token;
        localStorage.setItem('supabaseToken', token);
    }

    clearAuthToken() {
        this.authToken = null;
        localStorage.removeItem('supabaseToken');
    }
}

const supabase = new SupabaseClient();
