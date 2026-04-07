import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { crossAlert } from '../utils/alert';
import { useAuthStore } from '../store/authStore';
import {
  getCurrentSystemSettings,
  getAssignmentSnapshotThisWeek,
  getAssignmentSnapshotNextWeek,
  assignToPosition,
  cancelPosition,
  requestSwap,
  reportLateness,
  bulkCancelPositions,
  getSwapRequests,
  acceptSwapRequest,
  getAdminNotifications,
  getMySwapRequests,
  deleteSwapRequest,
} from '../api/endpoints';
import { SystemSettings, AssignmentSnapshot, AssignmentPosition, PositionAction, SwapRequestWithOffers, AdminNotification } from '../types';
import { usePeriodTimer } from '../hooks/usePeriodTimer';
import { useNotifications } from '../hooks/useNotifications';
import PeriodCountdown from '../components/PeriodCountdown';
import PositionActionsModal from '../components/PositionActionsModal';
import BulkCancelModal from '../components/BulkCancelModal';
import ReportLatenessModal from '../components/ReportLatenessModal';
import ConfirmationModal from '../components/ConfirmationModal';
import InfoModal from '../components/InfoModal';
import SwapRequestCard from '../components/SwapRequestCard';
import {
  groupPositionsByDate,
  groupPositionsByShift,
  separateSpecialEvents,
  formatDateWithDay,
  sortPositions,
  getAllDatesInWeek,
  isWorkingDay,
} from '../utils/scheduleHelpers';
import {
  getAvailableActions,
  isPositionClickable,
  ActionInfo,
  hasPositionStarted,
} from '../utils/positionActions';

type WeekView = 'this-week' | 'next-week';

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekView, setWeekView] = useState<WeekView>('this-week');
  const [snapshot, setSnapshot] = useState<AssignmentSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  
  // Modal states
  const [selectedPosition, setSelectedPosition] = useState<AssignmentPosition | null>(null);
  const [availableActions, setAvailableActions] = useState<ActionInfo[]>([]);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [bulkCancelModalVisible, setBulkCancelModalVisible] = useState(false);
  const [reportLatenessModalVisible, setReportLatenessModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PositionAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Swap requests state
  const [swapRequests, setSwapRequests] = useState<SwapRequestWithOffers[]>([]);
  const [swapRequestsLoading, setSwapRequestsLoading] = useState(false);
  
  // My active swap request state
  const [myActiveSwapRequest, setMyActiveSwapRequest] = useState<any | null>(null);
  const [mySwapRequestLoading, setMySwapRequestLoading] = useState(false);
  const [cancellingSwapRequest, setCancellingSwapRequest] = useState(false);
  
  // Admin notifications state
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(false);
  
  // Filtriraj samo moje assignmente za notifikacije o smjenama
  const myAssignments = useMemo(() => {
    if (!snapshot || user?.role !== 'guard') return null;
    const guardProfile = (user as any).guard_profile;
    if (!guardProfile) return null;
    return snapshot.positions.filter(
      (ap) => ap.is_taken && ap.guard && ap.guard.id === guardProfile.id
    );
  }, [snapshot, user]);

  const periodInfo = usePeriodTimer(settings);
  const { isEnabled: notificationsEnabled } = useNotifications(settings, myAssignments);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      fetchSnapshot();
    }
  }, [weekView, settings]);

  // Fetch swap requests za guardove
  useEffect(() => {
    if (user?.role === 'guard' && settings) {
      fetchSwapRequests();
    }
  }, [user, settings]);

  // Fetch admin notifications za guardove
  useEffect(() => {
    if (user?.role === 'guard' && settings) {
      fetchAdminNotifications();
    }
  }, [user, settings]);

  // Fetch my swap requests za guardove
  useEffect(() => {
    if (user?.role === 'guard' && settings) {
      fetchMySwapRequests();
    }
  }, [user, settings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getCurrentSystemSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading system settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSnapshot = async () => {
    if (!settings) return;
    
    setSnapshotLoading(true);
    try {
      const data = weekView === 'this-week' 
        ? await getAssignmentSnapshotThisWeek()
        : await getAssignmentSnapshotNextWeek();
      setSnapshot(data);
    } catch (error) {
      console.error('Error fetching snapshot:', error);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const fetchSwapRequests = async () => {
    if (user?.role !== 'guard') return;
    
    setSwapRequestsLoading(true);
    try {
      const data = await getSwapRequests();
      setSwapRequests(data);
    } catch (error) {
      console.error('Error fetching swap requests:', error);
      setSwapRequests([]);
    } finally {
      setSwapRequestsLoading(false);
    }
  };

  const fetchAdminNotifications = async () => {
    if (user?.role !== 'guard') return;
    
    setAdminNotificationsLoading(true);
    try {
      const data = await getAdminNotifications(1, { active: true });
      // Handle paginated response - data is an object with results array
      setAdminNotifications(data.results || []);
    } catch (error) {
      console.error('Error fetching admin notifications:', error);
      setAdminNotifications([]);
    } finally {
      setAdminNotificationsLoading(false);
    }
  };

  const fetchMySwapRequests = async () => {
    if (user?.role !== 'guard') return;
    
    setMySwapRequestLoading(true);
    try {
      const data = await getMySwapRequests();
      // Pronađi pending zahtjev
      const pendingRequest = data.find((req: any) => req.status === 'PENDING' || req.status === 'pending');
      setMyActiveSwapRequest(pendingRequest || null);
    } catch (error) {
      console.error('Error fetching my swap requests:', error);
      setMyActiveSwapRequest(null);
    } finally {
      setMySwapRequestLoading(false);
    }
  };

  const handleCancelMySwapRequest = async () => {
    if (!myActiveSwapRequest) return;
    
    crossAlert(
      'Poništi zahtjev',
      'Jeste li sigurni da želite poništiti svoj zahtjev za zamjenu?',
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Poništi',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingSwapRequest(true);
              await deleteSwapRequest(myActiveSwapRequest.id);
              setMyActiveSwapRequest(null);
              crossAlert('Uspjeh', 'Zahtjev za zamjenu je poništen');
              fetchSnapshot();
            } catch (error: any) {
              console.error('Error cancelling swap request:', error);
              crossAlert('Greška', error.response?.data?.detail || 'Nije moguće poništiti zahtjev');
            } finally {
              setCancellingSwapRequest(false);
            }
          },
        },
      ]
    );
  };

  const handleAcceptSwap = async (swapRequestId: number, positionOfferedId: number) => {
    try {
      const response = await acceptSwapRequest(swapRequestId, positionOfferedId);
      crossAlert('Uspjeh', response.message || 'Zamjena je uspješno prihvaćena!');
      
      // Refresh sve podatke
      await Promise.all([
        fetchSwapRequests(),
        fetchSnapshot(),
      ]);
    } catch (error: any) {
      console.error('Accept swap error:', error);
      crossAlert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri prihvaćanju zamjene.'
      );
    }
  };

  const handlePositionPress = useCallback((position: AssignmentPosition) => {
    if (!user || !periodInfo) return;
    
    // Provjeri da li se može kliknuti na poziciju
    const clickable = isPositionClickable({
      position,
      weekView,
      currentPeriod: periodInfo.type,
      user,
    });
    
    if (!clickable) {
      // Pozicija nije klikabilna - ne radi ništa
      return;
    }
    
    // Dohvati dostupne akcije
    const actions = getAvailableActions({
      position,
      weekView,
      currentPeriod: periodInfo.type,
      user,
    });
    
    setSelectedPosition(position);
    setAvailableActions(actions);
    setActionsModalVisible(true);
  }, [user, periodInfo, weekView]);

  const handleActionSelect = useCallback(async (action: PositionAction) => {
    if (!selectedPosition) return;
    
    // Zatvori action modal
    setActionsModalVisible(false);
    
    // Rukovanje specifičnim akcijama
    switch (action) {
      case 'assign':
        setPendingAction('assign');
        setConfirmModalVisible(true);
        break;
        
      case 'unassign':
        setPendingAction('unassign');
        setConfirmModalVisible(true);
        break;
        
      case 'cancel':
        setPendingAction('cancel');
        setConfirmModalVisible(true);
        break;
        
      case 'request_swap':
        setPendingAction('request_swap');
        setConfirmModalVisible(true);
        break;
        
      case 'report_lateness':
        setReportLatenessModalVisible(true);
        break;
        
      case 'bulk_cancel':
        setBulkCancelModalVisible(true);
        break;
        
      case 'challenge':
        // Prikaži info modal da dvoboji nisu dozvoljeni
        setInfoModalVisible(true);
        break;
    }
  }, [selectedPosition]);

  const handleConfirmAction = useCallback(async () => {
    if (!selectedPosition || !pendingAction) return;
    
    setActionLoading(true);
    try {
      let message = '';
      
      switch (pendingAction) {
        case 'assign':
          await assignToPosition(selectedPosition.position.id);
          message = 'Uspješno si se upisao/la na poziciju!';
          break;
          
        case 'unassign':
        case 'cancel':
          await cancelPosition(selectedPosition.position.id);
          message = pendingAction === 'unassign' 
            ? 'Uspješno si se ispisao/la s pozicije!'
            : 'Uspješno si otkazao/la poziciju!';
          break;
          
        case 'request_swap':
          await requestSwap(selectedPosition.position.id);
          message = 'Zahtjev za zamjenu je uspješno poslan!';
          break;
      }
      
      setConfirmModalVisible(false);
      setPendingAction(null);
      
      crossAlert('Uspjeh', message);
      
      // Refresh podataka
      await fetchSnapshot();
      
    } catch (error: any) {
      console.error('Action error:', error);
      crossAlert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške. Pokušaj ponovo.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [selectedPosition, pendingAction, fetchSnapshot]);

  const handleReportLateness = useCallback(async (estimatedDelayMinutes?: number) => {
    if (!selectedPosition) return;
    
    setActionLoading(true);
    try {
      const response = await reportLateness(selectedPosition.position.id, estimatedDelayMinutes);
      
      setReportLatenessModalVisible(false);
      
      const penaltyPoints = typeof response.penalty_applied.points === 'number' 
        ? response.penalty_applied.points 
        : parseFloat(response.penalty_applied.points as any);
      
      crossAlert(
        'Kašnjenje prijavljeno',
        `${response.message}\n\nKazna: ${penaltyPoints} bodova\n${response.penalty_applied.explanation}`
      );
      
      await fetchSnapshot();
      
    } catch (error: any) {
      console.error('Report lateness error:', error);
      crossAlert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri prijavi kašnjenja.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [selectedPosition, fetchSnapshot]);

  const handleBulkCancel = useCallback(async (startDate: string, endDate: string) => {
    setActionLoading(true);
    try {
      const response = await bulkCancelPositions(startDate, endDate);
      
      setBulkCancelModalVisible(false);
      
      if (response.cancelled_count > 0) {
        const penalty = typeof response.penalty_applied === 'number'
          ? response.penalty_applied
          : (parseFloat(String(response.penalty_applied)) || 0);
        
        crossAlert(
          'Smjene otkazane',
          penalty > 0 
            ? `${response.message}\n\nKazna: ${penalty} bodova`
            : response.message
        );
      } else {
        crossAlert('Info', 'Nema smjena za otkazati u odabranom periodu.');
      }
      
      await fetchSnapshot();
      
    } catch (error: any) {
      console.error('Bulk cancel error:', error);
      crossAlert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri otkazivanju smjena.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [fetchSnapshot]);

  const closeAllModals = useCallback(() => {
    setActionsModalVisible(false);
    setBulkCancelModalVisible(false);
    setReportLatenessModalVisible(false);
    setConfirmModalVisible(false);
    setInfoModalVisible(false);
    setPendingAction(null);
    setSelectedPosition(null);
  }, []);

  const getConfirmModalProps = useCallback(() => {
    if (!selectedPosition) return { title: '', message: '', confirmText: '', confirmColor: '' };
    
    const positionInfo = `${selectedPosition.position.exhibition_name} (${selectedPosition.position.date})`;
    
    switch (pendingAction) {
      case 'assign':
        return {
          title: 'Potvrdi upis',
          message: `Želiš li se upisati na poziciju:\n${positionInfo}?`,
          confirmText: 'Upiši se',
          confirmColor: '#A6C27A',
        };
      case 'unassign':
        return {
          title: 'Potvrdi ispis',
          message: `Želiš li se ispisati s pozicije:\n${positionInfo}?`,
          confirmText: 'Ispiši se',
          confirmColor: '#D3968C',
        };
      case 'cancel':
        return {
          title: 'Potvrdi otkazivanje',
          message: `Želiš li otkazati poziciju:\n${positionInfo}?\n\nOva akcija može rezultirati kaznenim bodovima.`,
          confirmText: 'Otkaži',
          confirmColor: '#D3968C',
        };
      case 'request_swap':
        return {
          title: 'Zatraži zamjenu',
          message: `Želiš li zatražiti zamjenu za poziciju:\n${positionInfo}?\n\nDrugi čuvari će moći prihvatiti tvoj zahtjev.`,
          confirmText: 'Zatraži',
          confirmColor: '#105666',
        };
      default:
        return { title: '', message: '', confirmText: '', confirmColor: '' };
    }
  }, [selectedPosition, pendingAction]);

  const handleLogout = async () => {
    await logout();
  };
  
  // Helper za određivanje stila pozicije
  const getPositionStyle = useCallback((position: AssignmentPosition) => {
    if (!user || !periodInfo) return {};
    
    const clickable = isPositionClickable({
      position,
      weekView,
      currentPeriod: periodInfo.type,
      user,
    });
    
    const styles: any = {};
    
    if (!clickable) {
      styles.opacity = 0.5;
    }
    
    // Provjeri da li je trenutni user upisan na ovu poziciju
    if (user.role === 'guard' && position.guard) {
      const guardUser = user as any; // GuardUser tip
      if (guardUser.guard_profile && position.guard.id === guardUser.guard_profile.id) {
        // Istakni poziciju trenutnog usera
        styles.borderWidth = 3;
        styles.borderColor = '#105666';
        styles.shadowColor = '#105666';
        styles.shadowOffset = { width: 0, height: 2 };
        styles.shadowOpacity = 0.3;
        styles.shadowRadius = 4;
        styles.elevation = 4;
      }
    }
    
    return styles;
  }, [user, periodInfo, weekView]);

  const headerColor = periodInfo?.color || '#0A3323';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Username hint */}
        {user && (
          <Text style={styles.usernameHint}>👤 {user.username}</Text>
        )}

        {/* Period countdown */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0A3323" />
          </View>
        ) : (
          <>
            <PeriodCountdown periodInfo={periodInfo} />
            {notificationsEnabled && (
              <Text style={styles.notificationHint}>🔔 Notifikacije omogućene</Text>
            )}
          </>
        )}
        
        {/* Admin Notifications Section - samo za guardove */}
        {user?.role === 'guard' && adminNotifications.length > 0 && (
          <View style={styles.adminNotificationsSection}>
            <Text style={styles.adminNotificationsTitle}>📢 Obavijesti</Text>
            {adminNotificationsLoading ? (
              <ActivityIndicator size="small" color="#0A3323" />
            ) : (
              adminNotifications.map(notification => (
                <View key={notification.id} style={styles.adminNotificationCard}>
                  <View style={styles.adminNotificationHeader}>
                    <Text style={styles.adminNotificationTitle}>{notification.title}</Text>
                    {notification.cast_type === 'broadcast' && (
                      <View style={styles.adminNotificationBadgeBroadcast}>
                        <Text style={styles.adminNotificationBadgeText}>Svima</Text>
                      </View>
                    )}
                    {notification.cast_type === 'unicast' && (
                      <View style={styles.adminNotificationBadgeUnicast}>
                        <Text style={styles.adminNotificationBadgeText}>Samo vama</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.adminNotificationMessage}>{notification.message}</Text>
                  {notification.created_by && (
                    <Text style={styles.adminNotificationMeta}>
                      — {notification.created_by.full_name}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
        
        {/* Swap Requests Section - samo za guardove */}
        {user?.role === 'guard' && settings && (
          <View style={styles.swapRequestsSection}>
            <Text style={styles.swapRequestsTitle}>Zamjene</Text>
            
            {/* My active swap request */}
            {mySwapRequestLoading ? (
              <ActivityIndicator size="small" color="#D3968C" />
            ) : myActiveSwapRequest && (
              <View style={styles.mySwapRequestCard}>
                <View style={styles.mySwapRequestHeader}>
                  <Text style={styles.mySwapRequestTitle}>Moj aktivni zahtjev za zamjenu</Text>
                </View>
                <View style={styles.mySwapRequestBody}>
                  <Text style={styles.mySwapRequestInfo}>
                    {myActiveSwapRequest.position_to_swap_details?.exhibition_name || 'Izložba'}
                  </Text>
                  <Text style={styles.mySwapRequestDate}>
                    {myActiveSwapRequest.position_to_swap_details?.date || ''} • {myActiveSwapRequest.position_to_swap_details?.start_time?.slice(0, 5) || ''} - {myActiveSwapRequest.position_to_swap_details?.end_time?.slice(0, 5) || ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.cancelSwapButton, cancellingSwapRequest && styles.buttonDisabled]}
                  onPress={handleCancelMySwapRequest}
                  disabled={cancellingSwapRequest}
                >
                  {cancellingSwapRequest ? (
                    <ActivityIndicator size="small" color="#A6C27A" />
                  ) : (
                    <Text style={styles.cancelSwapButtonText}>Poništi</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            
            {/* Other swap requests */}
            {swapRequestsLoading ? (
              <ActivityIndicator size="small" color="#D3968C" />
            ) : swapRequests.length > 0 ? (
              swapRequests.map(req => (
                <SwapRequestCard
                  key={req.swap_request.id}
                  swapRequest={req}
                  settings={settings}
                  onAccept={handleAcceptSwap}
                  loading={actionLoading}
                />
              ))
            ) : !myActiveSwapRequest && (
              <Text style={styles.noSwapRequestsText}>Nema dostupnih zahtjeva za zamjenu</Text>
            )}
          </View>
        )}
        
        {/* Toggle za tjedan i refresh button */}
        <View style={styles.weekToggleContainer}>
          <View style={styles.weekToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, weekView === 'this-week' && styles.toggleButtonActive]}
              onPress={() => setWeekView('this-week')}
            >
              <Text style={[styles.toggleText, weekView === 'this-week' && styles.toggleTextActive]}>
                Ovaj tjedan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, weekView === 'next-week' && styles.toggleButtonActive]}
              onPress={() => setWeekView('next-week')}
            >
              <Text style={[styles.toggleText, weekView === 'next-week' && styles.toggleTextActive]}>
                Sljedeći tjedan
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => {
              loadSettings();
              fetchSnapshot();
              if (user?.role === 'guard') {
                fetchSwapRequests();
                fetchAdminNotifications();
                fetchMySwapRequests();
              }
            }}
            disabled={snapshotLoading}
          >
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>

        {snapshotLoading ? (
          <ActivityIndicator size="large" color="#0A3323" style={{ marginTop: 32 }} />
        ) : snapshot ? (
          <>
            {(() => {
              // Filtriraj regular i special events
              const { regular, special } = separateSpecialEvents(snapshot.positions);
              
              // Grupiraj regular pozicije po datumima
              const positionsByDate = groupPositionsByDate(regular);
              
              // Generiraj sve datume u tjednu i filtriraj samo radne dane
              const allDates = getAllDatesInWeek(snapshot.week_start, snapshot.week_end);
              const workingDates = allDates.filter(date => isWorkingDay(date, settings!.workdays));

              return (
                <>
                  {/* Grid s karticama po danima (2 po redu) */}
                  <View style={styles.daysGrid}>
                    {workingDates.map(date => {
                      const dayPositions = positionsByDate[date] || [];
                      const { morning, afternoon } = groupPositionsByShift(dayPositions, date, settings!);
                      
                      return (
                        <View key={date} style={styles.dayCard}>
                          <Text style={styles.dayHeader}>{formatDateWithDay(date)}</Text>
                          
                          {/* Jutarnje smjene */}
                          <View style={styles.shiftSection}>
                            <Text style={styles.shiftLabel}>JUTRO</Text>
                            {morning.length > 0 && sortPositions(morning).map(pos => (
                              <TouchableOpacity
                                key={pos.position.id}
                                style={[styles.positionItem, !pos.is_taken && styles.positionEmpty, getPositionStyle(pos)]}
                                onPress={() => handlePositionPress(pos)}
                              >
                                <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                <Text style={styles.positionGuard}>
                                  {pos.guard ? pos.guard.username : ''}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {/* Popodnevne smjene */}
                          <View style={styles.shiftSection}>
                            <Text style={styles.shiftLabel}>POPODNE</Text>
                            {afternoon.length > 0 && sortPositions(afternoon).map(pos => (
                              <TouchableOpacity
                                key={pos.position.id}
                                style={[styles.positionItem, !pos.is_taken && styles.positionEmpty, getPositionStyle(pos)]}
                                onPress={() => handlePositionPress(pos)}
                              >
                                <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                <Text style={styles.positionGuard}>
                                  {pos.guard ? pos.guard.username : ''}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Posebni događaji */}
                  {special.length > 0 && (() => {
                    // Grupiraj posebne događaje po datumima
                    const specialByDate = groupPositionsByDate(special);
                    const specialDates = Object.keys(specialByDate).sort();

                    return (
                      <View style={styles.specialEventsSection}>
                        <Text style={styles.specialEventsTitle}>Posebni događaji</Text>
                        <View style={styles.daysGrid}>
                          {specialDates.map(date => {
                            const daySpecialPositions = specialByDate[date];
                            
                            return (
                              <View key={date} style={styles.specialDayCard}>
                                <Text style={styles.dayHeader}>{formatDateWithDay(date)}</Text>
                                {sortPositions(daySpecialPositions).map(pos => (
                                  <TouchableOpacity
                                    key={pos.position.id}
                                    style={[styles.positionItem, !pos.is_taken && styles.positionEmpty, getPositionStyle(pos)]}
                                    onPress={() => handlePositionPress(pos)}
                                  >
                                    <Text style={styles.specialEventTime}>
                                      {pos.position.start_time} - {pos.position.end_time}
                                    </Text>
                                    <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                    <Text style={styles.positionGuard}>
                                      {pos.guard ? pos.guard.username : ''}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}
                </>
              );
            })()}
          </>
        ) : (
          <Text style={styles.placeholder}>Nema podataka za ovaj tjedan</Text>
        )}
      </ScrollView>
      
      {/* Modals */}
      <PositionActionsModal
        visible={actionsModalVisible}
        position={selectedPosition}
        actions={availableActions}
        onClose={() => setActionsModalVisible(false)}
        onActionSelect={handleActionSelect}
      />
      
      <BulkCancelModal
        visible={bulkCancelModalVisible}
        onClose={() => setBulkCancelModalVisible(false)}
        onConfirm={handleBulkCancel}
        loading={actionLoading}
      />
      
      <ReportLatenessModal
        visible={reportLatenessModalVisible}
        position={selectedPosition}
        onClose={() => setReportLatenessModalVisible(false)}
        onConfirm={handleReportLateness}
        loading={actionLoading}
      />
      
      <ConfirmationModal
        visible={confirmModalVisible}
        {...getConfirmModalProps()}
        onClose={() => {
          setConfirmModalVisible(false);
          setPendingAction(null);
        }}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />
      
      <InfoModal
        visible={infoModalVisible}
        title="Dvoboji"
        message="Nažalost, dvoboji trenutno nisu dozvoljeni."
        onClose={() => setInfoModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  scrollContent: {
    padding: 20,
  },
  usernameHint: {
    fontSize: 14,
    color: '#105666',
    marginBottom: 15,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 14,
    color: '#0A3323',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  notificationHint: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
    color: '#0A3323',
    fontStyle: 'italic',
  },
  swapRequestsSection: {
    marginTop: 20,
    marginBottom: 4,
  },
  swapRequestsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#105666',
    marginBottom: 12,
  },
  weekToggleContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekToggle: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  refreshButton: {
    padding: 12,
    backgroundColor: '#A6C27A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  refreshButtonText: {
    fontSize: 20,
    color: '#0A3323',
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#A6C27A',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#A6C27A',
    borderColor: '#A6C27A',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3323',
  },
  toggleTextActive: {
    color: '#0A3323',
  },
  weekRange: {
    textAlign: 'center',
    fontSize: 13,
    color: '#0A3323',
    marginTop: 12,
    marginBottom: 8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  dayCard: {
    width: '48%',
    backgroundColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 8,
    textAlign: 'center',
  },
  shiftSection: {
    marginTop: 8,
  },
  shiftLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 4,
  },
  positionItem: {
    backgroundColor: '#A6C27A',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  positionEmpty: {
    backgroundColor: '#F7F4D5',
    borderLeftColor: '#105666',
  },
  positionExhibition: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3323',
  },
  positionGuard: {
    fontSize: 14,
    color: '#105666',
    marginTop: 2,
    fontWeight: '600',
  },
  specialEventsSection: {
    marginTop: 16,
  },
  specialEventsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 8,
  },
  specialDayCard: {
    width: '48%',
    backgroundColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#105666',
  },
  specialEventItem: {
    backgroundColor: '#A6C27A',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#105666',
  },
  specialEventDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#105666',
  },
  specialEventTime: {
    fontSize: 10,
    color: '#105666',
    marginTop: 2,
  },
  adminNotificationsSection: {
    marginTop: 20,
    marginBottom: 4,
  },
  adminNotificationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#105666',
    marginBottom: 12,
  },
  adminNotificationCard: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#105666',
  },
  adminNotificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  adminNotificationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0A3323',
    flex: 1,
    marginRight: 8,
  },
  adminNotificationBadgeBroadcast: {
    backgroundColor: '#105666',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adminNotificationBadgeUnicast: {
    backgroundColor: '#D3968C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adminNotificationBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#F7F4D5',
  },
  adminNotificationMessage: {
    fontSize: 14,
    color: '#0A3323',
    lineHeight: 20,
    marginBottom: 8,
  },
  adminNotificationMeta: {
    fontSize: 12,
    color: '#105666',
    fontStyle: 'italic',
  },
  // My swap request styles
  mySwapRequestCard: {
    backgroundColor: '#D3968C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0A3323',
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  mySwapRequestHeader: {
    marginBottom: 8,
  },
  mySwapRequestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A3323',
  },
  mySwapRequestBody: {
    marginBottom: 12,
  },
  mySwapRequestInfo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 4,
  },
  mySwapRequestDate: {
    fontSize: 13,
    color: '#0A3323',
  },
  cancelSwapButton: {
    backgroundColor: '#105666',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  cancelSwapButtonText: {
    color: '#F7F4D5',
    fontWeight: '600',
    fontSize: 14,
  },
  noSwapRequestsText: {
    color: '#0A3323',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
