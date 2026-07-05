import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { MapSearch } from '../components/MapSearch';
import { Search, Compass, MapPin } from 'lucide-react';

interface Property {
  id: string;
  title: string;
  type: string;
  rent: number;
  deposit: number;
  latitude: number;
  longitude: number;
  address: string;
  distance_m: number;
  photos: { url: string }[];
  viewCount: number;
}

export const Home: React.FC = () => {
  const navigate = useNavigate();

  // Search filter states
  const [lat, setLat] = useState<number>(23.0355); // Navrangpura, Ahmedabad center
  const [lng, setLng] = useState<number>(72.5647);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [type, setType] = useState<string>('');
  const [minRent, setMinRent] = useState<string>('');
  const [maxRent, setMaxRent] = useState<string>('');

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch properties from backend
  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        lat: lat.toString(),
        lng: lng.toString(),
        radiusKm: radiusKm.toString(),
      };

      if (type) params.type = type;
      if (minRent) params.minRent = minRent;
      if (maxRent) params.maxRent = maxRent;

      const queryString = new URLSearchParams(params).toString();
      const data = await api.get<Property[]>(`/properties?${queryString}`);
      setProperties(data);
    } catch (err: any) {
      setError(err.message || 'Failed to search properties');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch properties whenever location, radius, or filters change
  useEffect(() => {
    fetchProperties();
  }, [lat, lng, radiusKm, type]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProperties();
  };

  const handleLocationChange = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  };

  return (
    <div className="search-page">
      <MapSearch
        center={[lat, lng]}
        radiusKm={radiusKm}
        properties={properties}
        onLocationChange={handleLocationChange}
        onRadiusChange={setRadiusKm}
      />

      {/* Sidebar Filters & Cards Side */}
      <div className="sidebar-panel">
        <form className="filter-bar" onSubmit={handleSearchSubmit}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={20} className="accent-text" style={{ color: '#06b6d4' }} />
            Find Rental Listings
          </h3>

          <div className="filter-grid">
            <div className="form-group">
              <label>Property Type</label>
              <select
                className="form-control"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">Any Type</option>
                <option value="room">Room</option>
                <option value="flat">Flat</option>
                <option value="pg">PG</option>
                <option value="house">House</option>
              </select>
            </div>

            <div className="form-group">
              <label>Min Monthly Rent</label>
              <input
                type="number"
                placeholder="₹ Min"
                className="form-control"
                value={minRent}
                onChange={(e) => setMinRent(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Max Monthly Rent</label>
              <input
                type="number"
                placeholder="₹ Max"
                className="form-control"
                value={maxRent}
                onChange={(e) => setMaxRent(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Search size={16} />
              Apply Rent Range
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setType('');
                setMinRent('');
                setMaxRent('');
                setRadiusKm(5);
                setLat(23.0355);
                setLng(72.5647);
              }}
            >
              Reset
            </button>
          </div>
        </form>

        {/* Listings Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem 0.5rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>Available Listings</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{properties.length} Properties in View</p>
          </div>
          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem' }} title="Filter settings">
            ⚙️
          </button>
        </div>

        {/* Listings Cards Scroll List */}
        <div className="listings-list">
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              Searching active listings...
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              Error: {error}
            </div>
          )}

          {!loading && properties.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.05)' }}>
              <MapPin size={32} style={{ margin: '0 auto 1rem auto', color: '#64748b', opacity: 0.5 }} />
              <h4 style={{ color: '#cbd5e1', marginBottom: '0.3rem' }}>No approved listings found</h4>
              <p style={{ fontSize: '0.8rem' }}>Try expanding your search radius or clicking elsewhere on the map.</p>
            </div>
          )}

          {!loading &&
            properties.map((property) => {
              const photoUrl =
                property.photos && property.photos.length > 0
                  ? (property.photos[0].url.startsWith('http') ? property.photos[0].url : `http://localhost:5000${property.photos[0].url}`)
                  : 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=500&auto=format&fit=crop&q=60';

              return (
                <div
                  key={property.id}
                  className="listing-card"
                  onClick={() => navigate(`/listings/${property.id}`)}
                >
                  <div
                    className="listing-photo"
                    style={{ backgroundImage: `url(${photoUrl})` }}
                  >
                    <button 
                      type="button" 
                      className="listing-favorite-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        alert('Listing added to saved favorites!');
                      }}
                      style={{
                        position: 'absolute',
                        top: '0.8rem',
                        right: '0.8rem',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'rgba(16, 20, 21, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#ffb4ab',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      ❤️
                    </button>
                    <span 
                      className="listing-verified-chip"
                      style={{
                        position: 'absolute',
                        bottom: '0.8rem',
                        left: '0.8rem',
                        background: '#00fbfb',
                        color: '#003737',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {property.type === 'house' ? 'Rare Find' : 'Luxe Verified'}
                    </span>
                  </div>

                  <div className="listing-info">
                    <h3 className="listing-title" style={{ fontFamily: 'var(--font-heading)' }}>{property.title}</h3>
                    <p className="listing-address">
                      <MapPin size={12} style={{ color: '#00fbfb' }} />
                      {property.address}
                    </p>

                    <div className="listing-features-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.4rem 0' }}>
                      <div className="listing-price-tag">
                        <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>STARTING AT</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--border-color-focus)', fontFamily: 'var(--font-heading)' }}>
                          ₹{property.rent} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/mo</span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>🛏️ {property.type === 'room' || property.type === 'pg' ? 1 : 3}</span>
                        <span>🛁 {property.type === 'room' || property.type === 'pg' ? 1 : 2}</span>
                      </div>
                    </div>

                    <button 
                      type="button"
                      className="btn btn-primary" 
                      style={{ 
                        width: '100%', 
                        marginTop: '0.5rem', 
                        padding: '0.4rem', 
                        fontSize: '0.8rem',
                        background: 'transparent',
                        border: '1px solid #7c66ff',
                        color: '#c8bfff',
                        boxShadow: 'none'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/listings/${property.id}`);
                      }}
                    >
                      Contact Owner
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
