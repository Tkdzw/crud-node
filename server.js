const express = require('express');
require('dotenv').config();

const supabase = require('./config/supabase');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ==================== ROUTES ====================

// GET all items
app.get('/api/items', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single item
app.get('/api/items/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST create new item
app.post('/api/items', async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const { data, error } = await supabase
            .from('items')
            .insert([{ name, description }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT update item
app.put('/api/items/:id', async (req, res) => {
    try {
        const { name, description } = req.body;

        const { data, error } = await supabase
            .from('items')
            .update({ name, description })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(data);
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE item
app.delete('/api/items/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('items')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== WEB INTERFACE ====================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Supabase CRUD App</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 40px 20px; }
                .container { max-width: 900px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: white; font-size: 2.5rem; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
                .header p { color: rgba(255,255,255,0.9); }
                .card { background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
                .card h2 { color: #333; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; }
                .form-group input, .form-group textarea { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: border-color 0.3s; }
                .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #667eea; }
                .btn { background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
                .btn:hover { background: #5a67d8; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
                .items-list { display: grid; gap: 15px; }
                .item { background: #f8f9fa; border-radius: 8px; padding: 20px; border-left: 4px solid #667eea; transition: transform 0.2s, box-shadow 0.2s; }
                .item:hover { transform: translateX(5px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .item h3 { color: #333; margin-bottom: 8px; }
                .item p { color: #666; margin-bottom: 12px; }
                .item small { color: #999; font-size: 12px; display: block; margin-bottom: 12px; }
                .item-actions { display: flex; gap: 10px; }
                .btn-small { padding: 6px 14px; font-size: 13px; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: 500; }
                .btn-edit { background: #48bb78; color: white; }
                .btn-edit:hover { background: #38a169; }
                .btn-delete { background: #f56565; color: white; }
                .btn-delete:hover { background: #e53e3e; }
                .empty-state { text-align: center; padding: 40px; color: #999; }
                .loading { text-align: center; padding: 40px; color: #667eea; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 Supabase CRUD</h1>
                    <p>Connected to Supabase PostgreSQL Database</p>
                </div>

                <div class="card">
                    <h2>➕ Add New Item</h2>
                    <div class="form-group">
                        <label for="name">Name *</label>
                        <input type="text" id="name" placeholder="Enter item name" required />
                    </div>
                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea id="description" rows="3" placeholder="Enter description (optional)"></textarea>
                    </div>
                    <button class="btn" onclick="createItem()">Create Item</button>
                </div>

                <div class="card">
                    <h2>📋 Items List</h2>
                    <div id="items-list">
                        <div class="loading">Loading items...</div>
                    </div>
                </div>
            </div>

            <script>
                const API_URL = '/api/items';

                async function loadItems() {
                    const container = document.getElementById('items-list');
                    
                    try {
                        const response = await fetch(API_URL);
                        if (!response.ok) throw new Error('Failed to fetch items');
                        
                        const items = await response.json();
                        
                        if (items.length === 0) {
                            container.innerHTML = '<div class="empty-state">📭 No items yet. Create one above!</div>';
                            return;
                        }
                        
                        container.innerHTML = items.map(item => \`
                            <div class="item">
                                <h3>\${escapeHtml(item.name)}</h3>
                                <p>\${escapeHtml(item.description || 'No description')}</p>
                                <small>🕐 Created: \${new Date(item.created_at).toLocaleString()}</small>
                                <div class="item-actions">
                                    <button class="btn-small btn-edit" onclick="editItem(\${item.id}, '\${escapeHtml(item.name)}', '\${escapeHtml(item.description || '')}')">✏️ Edit</button>
                                    <button class="btn-small btn-delete" onclick="deleteItem(\${item.id})">🗑️ Delete</button>
                                </div>
                            </div>
                        \`).join('');
                    } catch (error) {
                        container.innerHTML = '<div class="empty-state">❌ Error loading items</div>';
                        console.error('Error:', error);
                    }
                }

                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }

                async function createItem() {
                    const nameInput = document.getElementById('name');
                    const descInput = document.getElementById('description');
                    const name = nameInput.value.trim();
                    const description = descInput.value.trim();

                    if (!name) {
                        alert('Name is required');
                        return;
                    }

                    try {
                        const response = await fetch(API_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, description })
                        });

                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.error || 'Failed to create item');
                        }

                        nameInput.value = '';
                        descInput.value = '';
                        loadItems();
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                }

                async function deleteItem(id) {
                    if (!confirm('Are you sure you want to delete this item?')) return;

                    try {
                        const response = await fetch(\`\${API_URL}/\${id}\`, {
                            method: 'DELETE'
                        });

                        if (!response.ok) throw new Error('Failed to delete item');
                        loadItems();
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                }

                async function editItem(id, currentName, currentDescription) {
                    const newName = prompt('Enter new name:', currentName);
                    if (newName === null) return;

                    const newDescription = prompt('Enter new description:', currentDescription);
                    if (newDescription === null) return;

                    try {
                        const response = await fetch(\`\${API_URL}/\${id}\`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                name: newName, 
                                description: newDescription 
                            })
                        });

                        if (!response.ok) throw new Error('Failed to update item');
                        loadItems();
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                }

                // Load items on page load
                loadItems();
            </script>
        </body>
        </html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📦 Connected to Supabase: ${process.env.SUPABASE_URL}`);
});