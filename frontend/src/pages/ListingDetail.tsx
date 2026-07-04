import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import L from 'leaflet';
import { 
  ChevronLeft, 
  ChevronRight, 
  Phone, 
  AlertTriangle, 
  MapPin, 
  CheckCircle, 
  Eye,
  Shield,
  Home as HomeIcon,
  IndianRupee,
  Heart,
  Car
} from 'lucide-react';

interface Photo {
  id: string;
  url: string;
}

interface PropertyDetail {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  type: string;
  rent: string;
  deposit: string;
  latitude: number;
  longitude: number;
  address: string;
  landmarks: string[];
  amenities: string[];
  status: string;
  viewCount: number;
  photos: Photo[];
  owner: {
    id: string;
    name: string;
  };
}

export const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carousel State
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Enquiry & Phone Reveal State
  const [revealedOwner, setRevealedOwner] = useState<{ name: string; phone: string } | null>(null);
  const [enquiryLoading, setEnquiryLoading] = useState(false);

  // Report Form State
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Local Map Ref
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Fetch listing details
  const fetchPropertyDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<PropertyDetail>(`/properties/${id}`);
      setProperty(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load property listing details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPropertyDetail();
  }, [id]);

  // Render static Leaflet map on property load
  useEffect(() => {
    if (!property || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [property.latitude, property.longitude],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const apiKey = import.meta.env.VITE_MAP_API_KEY || '';
    const formattedTileUrl = tileUrl.replace('{apiKey}', apiKey);
    const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    L.tileLayer(formattedTileUrl, {
      attribution,
    }).addTo(map);

    const propertyIcon = L.divIcon({
      className: 'property-pin-icon',
      html: `<div style="background-color: #7c66ff; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #7c66ff;"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([property.latitude, property.longitude], { icon: propertyIcon }).addTo(map);
    mapRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [property]);

  // Autoplay carousel slide every 2 seconds
  useEffect(() => {
    if (!property || !property.photos || property.photos.length <= 1) return;

    const interval = setInterval(() => {
      setActivePhotoIdx((prev) => (prev === property.photos.length - 1 ? 0 : prev + 1));
    }, 2000);

    return () => clearInterval(interval);
  }, [property]);

  // Carousel helpers
  const nextSlide = () => {
    if (!property) return;
    setActivePhotoIdx((prev) => (prev === property.photos.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    if (!property) return;
    setActivePhotoIdx((prev) => (prev === 0 ? property.photos.length - 1 : prev - 1));
  };

  // Trigger enquiry flow (reveals phone number and writes Enquiry row in DB)
  const handleRevealContact = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setEnquiryLoading(true);
      setError(null);
      const result = await api.post<{ ownerName: string; ownerPhone: string }>(`/properties/${id}/enquiry`);
      setRevealedOwner({ name: result.ownerName, phone: result.ownerPhone });
    } catch (err: any) {
      setError(err.message || 'Failed to contact owner');
    } finally {
      setEnquiryLoading(false);
    }
  };

  // Submit listing report flag
  const handleReportListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setReportLoading(true);
      setReportSuccess(null);
      setError(null);
      const result = await api.post<{ message: string }>(`/properties/${id}/report`, { reason: reportReason });
      setReportSuccess(result.message);
      setReportReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '5rem', color: '#94a3b8' }}>Loading property details...</div>;
  }

  if (!property) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem' }}>
        <h2 style={{ color: '#ffb4ab', marginBottom: '1rem' }}>Property Not Found</h2>
        <button onClick={() => navigate('/')} className="btn btn-secondary">
          Back to Search Map
        </button>
      </div>
    );
  }

  const defaultPhoto = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&auto=format&fit=crop&q=80';
  const hasPhotos = property.photos && property.photos.length > 0;
  const photoUrl = hasPhotos
    ? (property.photos[activePhotoIdx].url.startsWith('http') ? property.photos[activePhotoIdx].url : `http://localhost:5000${property.photos[activePhotoIdx].url}`)
    : defaultPhoto;

  return (
    <div className="detail-container">
      {/* Dynamic Keyframes for Pulsing Dot */}
      <style>{`
        @keyframes pulseDot {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
      `}</style>

      {/* Main Details Panel */}
      {/* Main Details Panel */}
      <div className="detail-main">
        {/* Full-Bleed Photo Gallery Carousel */}
        <div className="image-carousel">
          <div
            className="carousel-slide"
            style={{
              backgroundImage: `url(${photoUrl})`,
              height: '100%',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Top overlays: Badges */}
          <div style={{ position: 'absolute', top: '1.2rem', left: '1.2rem', display: 'flex', gap: '0.6rem', zIndex: 10 }}>
            <span style={{ background: 'rgba(124, 102, 255, 0.25)', border: '1px solid rgba(124, 102, 255, 0.4)', color: '#c8bfff', fontSize: '0.7rem', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', backdropFilter: 'blur(8px)' }}>
              Premium
            </span>
            <span style={{ background: 'rgba(0, 251, 251, 0.15)', border: '1px solid rgba(0, 251, 251, 0.3)', color: '#00fbfb', fontSize: '0.7rem', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', backdropFilter: 'blur(8px)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00fbfb', animation: 'pulseDot 1.5s infinite linear' }} />
              Live Availability
            </span>
          </div>

          {/* Slide Arrow Navigation Overlay */}
          {hasPhotos && property.photos.length > 1 && (
            <div style={{ position: 'absolute', bottom: '1.2rem', right: '1.2rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
              <button onClick={prevSlide} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 20, 21, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'var(--transition-fast)' }} title="Previous image">
                <ChevronLeft size={18} />
              </button>
              <button onClick={nextSlide} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 20, 21, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'var(--transition-fast)' }} title="Next image">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Listing Title & Address Header (Placed BELOW the image to prevent cover overlaps) */}
        <div style={{ padding: '1.2rem 0.2rem 0.6rem 0.2rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#ffffff', margin: 0, lineHeight: 1.25 }}>
            {property.title}
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c9c4d7', fontSize: '0.85rem', margin: '0.4rem 0 0 0' }}>
            <MapPin size={14} style={{ color: '#00fbfb' }} />
            {property.address}
          </p>
        </div>

        {/* Premium Key Specs Grid */}
        <div className="detail-specs-grid">
          <div className="glass-panel" style={{ padding: '0.8rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', borderRadius: '12px' }}>
            <HomeIcon size={20} style={{ color: '#00fbfb' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Property Type</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00fbfb' }}>{property.type.toUpperCase()}</span>
          </div>

          <div className="glass-panel" style={{ padding: '0.8rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', borderRadius: '12px' }}>
            <IndianRupee size={20} style={{ color: '#00fbfb' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Rent</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00fbfb' }}>₹{parseFloat(property.rent).toLocaleString()}</span>
          </div>

          <div className="glass-panel" style={{ padding: '0.8rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', borderRadius: '12px' }}>
            <Shield size={20} style={{ color: '#00fbfb' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Deposit</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00fbfb' }}>₹{parseFloat(property.deposit).toLocaleString()}</span>
          </div>

          <div className="glass-panel" style={{ padding: '0.8rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', borderRadius: '12px' }}>
            <Eye size={20} style={{ color: '#00fbfb' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Bedrooms</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00fbfb' }}>{property.type === 'room' || property.type === 'pg' ? '1 BR' : '3 BR'}</span>
          </div>
        </div>

        {/* Description Section */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ marginBottom: '0.8rem', fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>The Experience</h3>
          <p style={{ color: '#c9c4d7', whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{property.description}</p>
        </div>

        {/* Amenities & Landmarks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ marginBottom: '0.8rem', fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>Premium Amenities</h3>
            <div className="tags-list">
              {property.amenities.map((item, i) => (
                <span key={i} className="tag accent" style={{ background: 'rgba(0, 251, 251, 0.08)', color: '#00fbfb', border: '1px solid rgba(0, 251, 251, 0.15)' }}>
                  ✓ {item}
                </span>
              ))}
              {property.amenities.length === 0 && <span style={{ color: '#928ea1', fontSize: '0.8rem' }}>None specified</span>}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ marginBottom: '0.8rem', fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>Nearby Landmarks</h3>
            <div className="tags-list">
              {property.landmarks.map((item, i) => (
                <span key={i} className="tag" style={{ background: 'rgba(255,255,255,0.03)', color: '#e0e3e5' }}>
                  📍 {item}
                </span>
              ))}
              {property.landmarks.length === 0 && <span style={{ color: '#928ea1', fontSize: '0.8rem' }}>None specified</span>}
            </div>
          </div>
        </div>

        {/* Map Location visualization */}
        <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>Location on Map</h3>
          </div>
          <div ref={mapContainerRef} style={{ height: '220px', borderRadius: '12px' }} />
        </div>
      </div>

      {/* Sidebar Panel */}
      <div className="detail-sidebar">
        {/* Contact Owner Action */}
        <div className="glass-panel contact-card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>MONTHLY RENT</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                ₹{parseFloat(property.rent).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/mo</span>
              </span>
            </div>
            <button type="button" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffb4ab', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Save listing">
              <Heart size={16} />
            </button>
          </div>

          {error && (
            <div style={{ color: '#ffb4ab', fontSize: '0.8rem', background: 'rgba(255, 180, 171, 0.08)', padding: '0.6rem', borderRadius: '6px', textAlign: 'left' }}>
              ⚠️ {error}
            </div>
          )}

          {!user ? (
            <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }}>
              Login to Contact Owner
            </button>
          ) : user.role !== 'tenant' ? (
            <div style={{ fontSize: '0.8rem', color: '#c9c4d7', background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              🔒 Contacting owner is only available for Tenants.
            </div>
          ) : revealedOwner ? (
            <div className="phone-reveal-box" style={{ background: 'rgba(0, 251, 251, 0.04)', border: '1px solid rgba(0, 251, 251, 0.2)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#00fbfb', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                Owner: {revealedOwner.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                <Phone size={18} style={{ color: '#00fbfb' }} />
                <span>{revealedOwner.phone}</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                ⚠️ Unverified Phone (Beta Mode)
              </div>
            </div>
          ) : (
            <button onClick={handleRevealContact} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', gap: '0.5rem' }} disabled={enquiryLoading}>
              <Phone size={16} />
              {enquiryLoading ? 'Revealing...' : 'Contact Owner'}
            </button>
          )}

          {/* Map Directions Link Button */}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              padding: '0.8rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#e0e3e5',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <Car size={16} />
            Get Directions
          </a>

          <p style={{ fontSize: '0.75rem', color: '#928ea1', textAlign: 'center', margin: 0 }}>
            🤝 Direct deal. No commissions, booking fees, or escrows.
          </p>
        </div>

        {/* Flag Listing Form */}
        {user && user.role === 'tenant' && (
          <div className="glass-panel report-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffb4ab', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
              <AlertTriangle size={16} />
              Flag this Listing
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#c9c4d7', marginBottom: '0.8rem' }}>
              Is this listing fake, misleading, or a duplicate? Report it to the moderators.
            </p>

            {reportSuccess ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.8rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={14} />
                <span>{reportSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleReportListing} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why you are reporting this listing..."
                  className="form-control"
                  style={{ resize: 'none' }}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                />
                <button type="submit" className="btn btn-danger" style={{ width: '100%', padding: '0.5rem' }} disabled={reportLoading}>
                  {reportLoading ? 'Submitting...' : 'Submit Report'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
