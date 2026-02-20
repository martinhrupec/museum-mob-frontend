import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
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
  
  const periodInfo = usePeriodTimer(settings);
  const { isEnabled: notificationsEnabled } = useNotifications(settings);

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
      const data = await getAdminNotifications();
      setAdminNotifications(data);
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
    
    Alert.alert(
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
              Alert.alert('Uspjeh', 'Zahtjev za zamjenu je poništen');
              fetchSnapshot();
            } catch (error: any) {
              console.error('Error cancelling swap request:', error);
              Alert.alert('Greška', error.response?.data?.detail || 'Nije moguće poništiti zahtjev');
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
      Alert.alert('Uspjeh', response.message || 'Zamjena je uspješno prihvaćena!');
      
      // Refresh sve podatke
      await Promise.all([
        fetchSwapRequests(),
        fetchSnapshot(),
      ]);
    } catch (error: any) {
      console.error('Accept swap error:', error);
      Alert.alert(
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
      
      Alert.alert('Uspjeh', message);
      
      // Refresh podataka
      await fetchSnapshot();
      
    } catch (error: any) {
      console.error('Action error:', error);
      Alert.alert(
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
      
      Alert.alert(
        'Kašnjenje prijavljeno',
        `${response.message}\n\nKazna: ${penaltyPoints} bodova\n${response.penalty_applied.explanation}`
      );
      
      await fetchSnapshot();
      
    } catch (error: any) {
      console.error('Report lateness error:', error);
      Alert.alert(
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
        
        Alert.alert(
          'Smjene otkazane',
          penalty > 0 
            ? `${response.message}\n\nKazna: ${penalty} bodova`
            : response.message
        );
      } else {
        Alert.alert('Info', 'Nema smjena za otkazati u odabranom periodu.');
      }
      
      await fetchSnapshot();
      
    } catch (error: any) {
      console.error('Bulk cancel error:', error);
      Alert.alert(
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
          confirmColor: '#4caf50',
        };
      case 'unassign':
        return {
          title: 'Potvrdi ispis',
          message: `Želiš li se ispisati s pozicije:\n${positionInfo}?`,
          confirmText: 'Ispiši se',
          confirmColor: '#f44336',
        };
      case 'cancel':
        return {
          title: 'Potvrdi otkazivanje',
          message: `Želiš li otkazati poziciju:\n${positionInfo}?\n\nOva akcija može rezultirati kaznenim bodovima.`,
          confirmText: 'Otkaži',
          confirmColor: '#f44336',
        };
      case 'request_swap':
        return {
          title: 'Zatraži zamjenu',
          message: `Želiš li zatražiti zamjenu za poziciju:\n${positionInfo}?\n\nDrugi čuvari će moći prihvatiti tvoj zahtjev.`,
          confirmText: 'Zatraži',
          confirmColor: '#ff9800',
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
          <Text style={styles.usernameHint}>👤 👉 {user.username}</Text>
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
                    {myActiveSwapRequest.position?.exhibition_name || 'Izložba'}
                  </Text>
                  <Text style={styles.mySwapRequestDate}>
                    📅 {myActiveSwapRequest.position?.date || ''} • {myActiveSwapRequest.position?.start_time?.slice(0, 5) || ''} - {myActiveSwapRequest.position?.end_time?.slice(0, 5) || ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.cancelSwapButton, cancellingSwapRequest && styles.buttonDisabled]}
                  onPress={handleCancelMySwapRequest}
                  disabled={cancellingSwapRequest}
                >
                  {cancellingSwapRequest ? (
                    <ActivityIndicator size="small" color="#839958" />
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
                            <Text style={styles.shiftLabel}>Jutro</Text>
                            {morning.length > 0 && sortPositions(morning).map(pos => (
                              <TouchableOpacity
                                key={pos.position.id}
                                style={[styles.positionItem, !pos.is_taken && styles.positionEmpty, getPositionStyle(pos)]}
                                onPress={() => handlePositionPress(pos)}
                              >
                                <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                <Text style={styles.positionGuard}>
                                  {pos.guard ? pos.guard.full_name : '[Prazno]'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {/* Popodnevne smjene */}
                          <View style={styles.shiftSection}>
                            <Text style={styles.shiftLabel}>Popodne</Text>
                            {afternoon.length > 0 && sortPositions(afternoon).map(pos => (
                              <TouchableOpacity
                                key={pos.position.id}
                                style={[styles.positionItem, !pos.is_taken && styles.positionEmpty, getPositionStyle(pos)]}
                                onPress={() => handlePositionPress(pos)}
                              >
                                <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                <Text style={styles.positionGuard}>
                                  {pos.guard ? pos.guard.full_name : '[Prazno]'}
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
                                    style={[styles.specialEventItem, !pos.is_taken && styles.positionEmpty, getPositionStyle(pos)]}
                                    onPress={() => handlePositionPress(pos)}
                                  >
                                    <Text style={styles.specialEventTime}>
                                      {pos.position.start_time} - {pos.position.end_time}
                                    </Text>
                                    <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                    <Text style={styles.positionGuard}>
                                      {pos.guard ? pos.guard.full_name : '[Prazno]'}
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
    color: '#839958',
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
    color: '#839958',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  notificationHint: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
    color: '#839958',
    fontStyle: 'italic',
  },
  swapRequestsSection: {
    marginTop: 20,
    marginBottom: 4,
  },
  swapRequestsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D3968C',
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
    backgroundColor: '#0A3323',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  refreshButtonText: {
    fontSize: 20,
    color: '#839958',
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#839958',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#0A3323',
    borderColor: '#0A3323',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#839958',
  },
  toggleTextActive: {
    color: '#839958',
  },
  weekRange: {
    textAlign: 'center',
    fontSize: 13,
    color: '#839958',
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
    backgroundColor: '#0A3323',
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
    color: '#839958',
    marginBottom: 8,
    textAlign: 'center',
  },
  shiftSection: {
    marginTop: 8,
  },
  shiftLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D3968C',
    marginBottom: 4,
  },
  positionItem: {
    backgroundColor: '#839958',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#105666',
  },
  positionEmpty: {
    backgroundColor: '#D3968C',
    borderLeftColor: '#F7F4D5',
  },
  positionExhibition: {
    fontSize: 10,
    fontWeight: '600',
    color: '#105666',
  },
  positionGuard: {
    fontSize: 9,
    color: '#0A3323',
    marginTop: 2,
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
    backgroundColor: '#105666',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#839958',
  },
  specialEventItem: {
    backgroundColor: '#839958',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#105666',
  },
  specialEventDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#105666',
  },
  specialEventTime: {
    fontSize: 10,
    color: '#0A3323',
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
    backgroundColor: '#0A3323',
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
    color: '#839958',
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
    color: '#F7F4D5',
    lineHeight: 20,
    marginBottom: 8,
  },
  adminNotificationMeta: {
    fontSize: 12,
    color: '#D3968C',
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
    color: '#F7F4D5',
    marginBottom: 4,
  },
  mySwapRequestDate: {
    fontSize: 13,
    color: '#F7F4D5',
  },
  cancelSwapButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  cancelSwapButtonText: {
    color: '#839958',
    fontWeight: '600',
    fontSize: 14,
  },
  noSwapRequestsText: {
    color: '#839958',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
