import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import L from 'leaflet';
import { Plus, Trash2, Edit3, MessageSquare, ClipboardList, Image, Camera } from 'lucide-react';

interface Photo {
  id?: string;
  url: string;
}

interface Enquiry {
  id: string;
  propertyId: string;
  tenantId: string;
  createdAt: string;
  tenant: {
    name: string;
    phone: string;
  };
}

interface Property {
  id: string;
  title: string;
  description: string;
  type: string;
  rent: number;
  deposit: number;
  latitude: number;
  longitude: number;
  address: string;
  landmarks: string[];
  amenities: string[];
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejectionReason: string | null;
  viewCount: number;
  photos: Photo[];
  enquiries: Enquiry[];
}

export const OwnerDashboard: React.FC = () => {
  useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // Form Fields State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'room' | 'flat' | 'pg' | 'house'>('flat');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');
  const [address, setAddress] = useState('');
  const [landmarks, setLandmarks] = useState('');
  const [amenities, setAmenities] = useState('');
  
  // File Upload State
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Geocoding State
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [locatingOwner, setLocatingOwner] = useState(false);

  // Map Picker State inside modal
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Fetch properties owned by current user
  const fetchMyProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Property[]>('/properties?myListings=true');
      setProperties(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProperties();
  }, []);

  // Initialize Map Picker inside Modal
  useEffect(() => {
    if (!showModal || !mapContainerRef.current) return;

    // Destroy old map if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }

    const initialLat = parseFloat(latitude) || 12.9716;
    const initialLng = parseFloat(longitude) || 77.5946;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'picker-pin-icon',
      html: `<div style="background-color: #6366f1; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #6366f1;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const marker = L.marker([initialLat, initialLng], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);

    // Sync input fields on drag end
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setLatitude(position.lat.toFixed(6));
      setLongitude(position.lng.toFixed(6));
    });

    // Sync input fields on map click
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setLatitude(e.latlng.lat.toFixed(6));
      setLongitude(e.latlng.lng.toFixed(6));
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [showModal]);

  // Sync marker position if user types lat/lng values manually
  const handleLatLongBlur = () => {
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (!isNaN(latNum) && !isNaN(lngNum) && mapRef.current && markerRef.current) {
      const latlng = L.latLng(latNum, lngNum);
      markerRef.current.setLatLng(latlng);
      mapRef.current.setView(latlng, mapRef.current.getZoom());
    }
  };

  const handleOpenAddModal = () => {
    setEditingProperty(null);
    setTitle('');
    setDescription('');
    setType('flat');
    setRent('');
    setDeposit('');
    setLatitude('12.9716');
    setLongitude('77.5946');
    setAddress('');
    setLandmarks('');
    setAmenities('');
    setUploadedPhotos([]);
    setShowModal(true);
  };

  const handleOpenEditModal = (property: Property) => {
    setEditingProperty(property);
    setTitle(property.title);
    setDescription(property.description);
    setType(property.type as any);
    setRent(property.rent.toString());
    setDeposit(property.deposit.toString());
    setLatitude(property.latitude.toString());
    setLongitude(property.longitude.toString());
    setAddress(property.address);
    setLandmarks(property.landmarks.join(', '));
    setAmenities(property.amenities.join(', '));
    setUploadedPhotos(property.photos.map((p) => p.url));
    setShowModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }

    try {
      setUploading(true);
      setError(null);
      const result = await api.post<{ urls: string[] }>('/properties/upload', formData);
      setUploadedPhotos((prev) => [...prev, ...result.urls]);
    } catch (err: any) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGeocodeAddress = async () => {
    if (!address || address.trim() === '') {
      alert('Please enter a street address first');
      return;
    }

    const apiKey = import.meta.env.VITE_LOCATION_IQ_API_KEY || '';
    if (!apiKey) {
      alert('LocationIQ API Key is not configured in VITE_LOCATION_IQ_API_KEY');
      return;
    }

    try {
      setGeocodingLoading(true);
      
      const queryUrl = `https://us1.locationiq.com/v1/search?key=${apiKey}&q=${encodeURIComponent(address)}&format=json&limit=1`;
      const response = await fetch(queryUrl);
      if (!response.ok) {
        throw new Error('Address search failed or geocoding quota reached');
      }

      const results = await response.json();
      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        setLatitude(parseFloat(lat).toFixed(6));
        setLongitude(parseFloat(lon).toFixed(6));

        if (mapRef.current && markerRef.current) {
          const latlng = L.latLng(parseFloat(lat), parseFloat(lon));
          markerRef.current.setLatLng(latlng);
          mapRef.current.setView(latlng, 15);
        }
      } else {
        alert('Address coordinates could not be resolved. Please pin the location manually on the map.');
      }
    } catch (err: any) {
      alert('Failed to find address: ' + (err.message || 'Unknown error'));
    } finally {
      setGeocodingLoading(false);
    }
  };

  const handleLocateOwnerPosition = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocatingOwner(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: userLat, longitude: userLng } = position.coords;
        setLatitude(userLat.toFixed(6));
        setLongitude(userLng.toFixed(6));

        if (mapRef.current && markerRef.current) {
          const latlng = L.latLng(userLat, userLng);
          markerRef.current.setLatLng(latlng);
          mapRef.current.setView(latlng, 15);
        }
        setLocatingOwner(false);
      },
      (error) => {
        console.error('Error fetching position:', error);
        alert('Could not determine current location. Please verify browser location permissions are enabled.');
        setLocatingOwner(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      title,
      description,
      type,
      rent: parseFloat(rent),
      deposit: parseFloat(deposit),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      landmarks: landmarks.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
      amenities: amenities.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
      photos: uploadedPhotos,
    };

    try {
      if (editingProperty) {
        // Edit property
        await api.patch(`/properties/${editingProperty.id}`, payload);
      } else {
        // Create new property
        await api.post('/properties', payload);
      }
      setShowModal(false);
      fetchMyProperties();
    } catch (err: any) {
      setError(err.message || 'Failed to save property listing');
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    if (!window.confirm('Are you sure you want to delete this property? This action is permanent.')) return;
    try {
      await api.delete(`/properties/${propertyId}`);
      fetchMyProperties();
    } catch (err: any) {
      setError(err.message || 'Failed to delete listing');
    }
  };

  // Compile all enquiries (leads) across all properties
  const allLeads = properties.flatMap((p) =>
    p.enquiries.map((e) => ({
      ...e,
      propertyTitle: p.title,
    }))
  );

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '2rem' }}>Property Owner Dashboard</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            List new rentals and view incoming leads
          </p>
        </div>
        <button onClick={handleOpenAddModal} className="btn btn-primary">
          <Plus size={16} />
          List New Property
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
          Error: {error}
        </div>
      )}

      {/* Owner Listings Grid */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ClipboardList size={18} style={{ color: '#6366f1' }} />
          Your Rental Listings ({properties.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading your listings...</div>
        ) : properties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8' }}>
            No listings created yet. Tap "List New Property" to create one.
          </div>
        ) : (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Property details</th>
                  <th>Type</th>
                  <th>Rent / Deposit</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.title}</div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{p.address}</div>
                        {p.status === 'rejected' && p.rejectionReason && (
                          <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.3rem', background: 'rgba(239,68,68,0.08)', padding: '0.4rem', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
                            ⚠️ Rejected reason: {p.rejectionReason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{p.type}</td>
                    <td>
                      <div>₹{p.rent}/mo</div>
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Dep: ₹{p.deposit}</div>
                    </td>
                    <td>
                      <span className={`listing-status-badge ${p.status}`}>{p.status}</span>
                    </td>
                    <td>{p.viewCount}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          title="Edit Listing"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProperty(p.id)}
                          className="btn btn-danger"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          title="Delete Listing"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leads / Enquiries Log */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={18} style={{ color: '#06b6d4' }} />
          Tenant Lead Contacts ({allLeads.length})
        </h2>

        {allLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8' }}>
            No leads received yet. Once tenants request your phone number, they will appear here.
          </div>
        ) : (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Tenant Name</th>
                  <th>Tenant Phone</th>
                  <th>Listing Title</th>
                  <th>Revealed Date</th>
                </tr>
              </thead>
              <tbody>
                {allLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 600 }}>{lead.tenant.name}</td>
                    <td style={{ color: '#06b6d4' }}>
                      {lead.tenant.phone}
                      <span style={{ fontSize: '0.65rem', color: '#f59e0b', display: 'block', marginTop: '0.1rem', fontWeight: 600 }}>
                        ⚠️ Unverified Phone
                      </span>
                    </td>
                    <td>{lead.propertyTitle}</td>
                    <td style={{ color: '#94a3b8' }}>{new Date(lead.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Add Property Modal Dialog */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ background: '#0f172a', borderColor: '#1e293b' }}>
            <h2 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              {editingProperty ? 'Edit Property Listing' : 'List New Property'}
            </h2>

            <form onSubmit={handleFormSubmit} className="modal-form">
              <div className="form-group">
                <label>Property Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Spacious 2BHK flat near Metro Station"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write details about the rooms, pricing structure, rules, etc."
                  className="form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="filter-grid">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    className="form-control"
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                  >
                    <option value="room">Room</option>
                    <option value="flat">Flat</option>
                    <option value="pg">PG</option>
                    <option value="house">House</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Monthly Rent (₹)</label>
                  <input
                    required
                    type="number"
                    placeholder="₹ 12000"
                    className="form-control"
                    value={rent}
                    onChange={(e) => setRent(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Security Deposit (₹)</label>
                  <input
                    required
                    type="number"
                    placeholder="₹ 24000"
                    className="form-control"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Street Address</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Flat 302, Green Avenue, Indiranagar"
                    className="form-control"
                    style={{ flex: 1 }}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.6rem', fontSize: '0.85rem' }}
                    onClick={handleGeocodeAddress}
                    disabled={geocodingLoading}
                  >
                    {geocodingLoading ? 'Searching...' : '🔍 Locate'}
                  </button>
                </div>
              </div>

              {/* Coordinates Map Picker */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ margin: 0 }}>Geospatial Location (Click Map to Place Pin)</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '4px', color: '#fff', fontWeight: 600 }}
                    onClick={handleLocateOwnerPosition}
                    disabled={locatingOwner}
                  >
                    {locatingOwner ? '📡 Scanning...' : '🧭 Use Current Location'}
                  </button>
                </div>
                <div ref={mapContainerRef} style={{ height: '200px', borderRadius: '8px', marginBottom: '0.8rem' }} />
                
                <div className="filter-grid">
                  <div className="form-group">
                    <label>Latitude</label>
                    <input
                      required
                      type="text"
                      className="form-control"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      onBlur={handleLatLongBlur}
                    />
                  </div>
                  <div className="form-group">
                    <label>Longitude</label>
                    <input
                      required
                      type="text"
                      className="form-control"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      onBlur={handleLatLongBlur}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Nearby Landmarks (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Metro Station, Corner House Coffee"
                  className="form-control"
                  value={landmarks}
                  onChange={(e) => setLandmarks(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Amenities (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Wifi, AC, Balcony, Power Backup"
                  className="form-control"
                  value={amenities}
                  onChange={(e) => setAmenities(e.target.value)}
                />
              </div>

              {/* Photo Upload Section */}
              <div className="form-group">
                <label>Upload Property Photos (Max 5)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  {/* Gallery Selection */}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                    id="photo-file-input"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="photo-file-input"
                    className="btn btn-secondary"
                    style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Image size={16} />
                    {uploading ? 'Uploading...' : 'Choose Photos'}
                  </label>

                  {/* Camera Capture Option */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                    id="photo-camera-input"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="photo-camera-input"
                    className="btn btn-secondary"
                    style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Camera size={16} />
                    {uploading ? 'Capturing...' : 'Capture Photo'}
                  </label>
                </div>

                {/* Photo Previews */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                  {uploadedPhotos.map((url, index) => (
                    <div
                      key={index}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        backgroundImage: `url(${url.startsWith('http') ? url : `http://localhost:5000${url}`})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(index)}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          background: 'rgba(239, 68, 68, 0.85)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingProperty ? 'Save Changes' : 'Submit Listing'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
