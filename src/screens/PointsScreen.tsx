import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { crossAlert } from '../utils/alert';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../store/authStore';
import {
  getPoints,
  createPoint,
  getCurrentSystemSettings,
  getGuards,
} from '../api/endpoints';
import { Point, PointListResponse, SystemSettings, GuardProfile, GuardUser } from '../types';

type SortOrder = 'asc' | 'desc';

export default function PointsScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const guardUser = user?.role === 'guard' ? (user as GuardUser) : null;

  // Data state
  const [points, setPoints] = useState<Point[]>([]);
  const [guards, setGuards] = useState<GuardProfile[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  // Filter & Sort state
  const [guardFilter, setGuardFilter] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showGuardDropdown, setShowGuardDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Temp state za filter modal (primjenjuje se tek na "Primijeni")
  const [tempGuardFilter, setTempGuardFilter] = useState<number | null>(null);
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>('desc');

  // Create Point Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGuardId, setSelectedGuardId] = useState<number | null>(null);
  const [pointsValue, setPointsValue] = useState('');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGuardPickerModal, setShowGuardPickerModal] = useState(false);

  // Late Without Notification Modal
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateGuardId, setLateGuardId] = useState<number | null>(null);
  const [showLateGuardPicker, setShowLateGuardPicker] = useState(false);
  const [lateSubmitting, setLateSubmitting] = useState(false);

  // Explanation Modal
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  // Ref to track initial load
  const initialLoadDone = useRef(false);

  useEffect(() => {
    fetchInitialData();
    return () => {
      setShowFiltersModal(false);
      setShowGuardDropdown(false);
      setShowSortDropdown(false);
      setShowCreateModal(false);
      setShowLateModal(false);
      setShowExplanationModal(false);
      setShowLateGuardPicker(false);
      setShowGuardPickerModal(false);
    };
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) {
      // Reset to page 1 and fetch data when filters change
      fetchPoints(1);
    }
  }, [guardFilter, sortOrder]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [settingsData, guardsData] = await Promise.all([
        getCurrentSystemSettings(),
        isAdmin ? getGuards() : Promise.resolve([]),
      ]);
      setSettings(settingsData);
      if (isAdmin) {
        setGuards(guardsData);
      }
      
      // Load initial points
      await fetchPoints(1);
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error fetching initial data:', error);
      crossAlert('Greška', 'Nije moguće učitati podatke');
    } finally {
      setLoading(false);
    }
  };

  const fetchPoints = async (pageNum: number = page) => {
    try {
      if (!initialLoadDone.current) {
        // Initial load handled by fetchInitialData
        setLoading(true);
      }

      // Build filters for backend
      const filters: any = {};
      
      if (guardFilter !== null) {
        filters.guard_id = guardFilter;
      }
      
      filters.ordering = sortOrder === 'desc' ? '-date_awarded' : 'date_awarded';
      
      const response: PointListResponse = await getPoints(pageNum, filters);
      
      setPoints(response.results);
      setNext(response.next || null);
      setPrev(response.previous || null);
      setCount(response.count || 0);
      setPage(pageNum);
    } catch (error: any) {
      console.error('Error fetching points:', error);
      crossAlert('Greška', 'Nije moguće učitati bodove');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPoints(1);
  }, [guardFilter, sortOrder]);

  // Funkcije za filter modal
  const openFiltersModal = () => {
    setTempGuardFilter(guardFilter);
    setTempSortOrder(sortOrder);
    setShowFiltersModal(true);
      // These lines ensure no other modals are open
    setShowGuardDropdown(false);
    setShowSortDropdown(false);
    setShowCreateModal(false);
    setShowLateModal(false);
    setShowExplanationModal(false);
    setShowLateGuardPicker(false);
    setShowGuardPickerModal(false);
  };

  const applyFilters = () => {
    setGuardFilter(tempGuardFilter);
    setSortOrder(tempSortOrder);
    setShowFiltersModal(false);
  };

  const cancelFilters = () => {
    setShowFiltersModal(false);
  };

  const handleCreatePoint = async () => {
    if (!selectedGuardId) {
      crossAlert('Greška', 'Odaberite čuvara');
      return;
    }

    const pointsNum = parseFloat(pointsValue);
    if (isNaN(pointsNum)) {
      crossAlert('Greška', 'Bodovi moraju biti broj');
      return;
    }
    if (pointsNum < -10 || pointsNum > 10) {
      crossAlert('Greška', 'Bodovi moraju biti između -10 i 10');
      return;
    }
    if (!explanation.trim()) {
      crossAlert('Greška', 'Unesite objašnjenje');
      return;
    }

    try {
      setSubmitting(true);
      await createPoint({
        guard: selectedGuardId,
        points: pointsNum,
        explanation: explanation.trim(),
      });
      setShowCreateModal(false);
      resetCreateForm();
      fetchPoints(1);
      crossAlert('Uspjeh', 'Bodovi su uspješno dodijeljeni');
    } catch (error: any) {
      console.error('Error creating point:', error);
      crossAlert('Greška', error.response?.data?.detail || 'Nije moguće dodijeliti bodove');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLateWithoutNotification = async () => {
    if (!lateGuardId) {
      crossAlert('Greška', 'Odaberite čuvara');
      return;
    }
    if (!settings) {
      crossAlert('Greška', 'Postavke sustava nisu učitane');
      return;
    }

    const penaltyPoints = parseFloat(settings.penalty_for_being_late_without_notification);

    try {
      setLateSubmitting(true);
      await createPoint({
        guard: lateGuardId,
        points: penaltyPoints,
        explanation: 'Zakašnjenje bez obavijesti',
      });
      setShowLateModal(false);
      setLateGuardId(null);
      fetchPoints(1);
      crossAlert('Uspjeh', 'Kazna za zakašnjenje bez obavijesti je dodijeljena');
    } catch (error: any) {
      console.error('Error creating late penalty:', error);
      crossAlert('Greška', error.response?.data?.detail || 'Nije moguće dodijeliti kaznu');
    } finally {
      setLateSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedGuardId(null);
    setPointsValue('');
    setExplanation('');
  };

  const getGuardDisplayName = (guardId: number | null): string => {
    if (guardId === null) return 'Odaberi čuvara';
    const guard = guards.find(g => g.id === guardId);
    return guard?.full_name || guard?.username || 'Nepoznato';
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPointItem = ({ item }: { item: Point }) => {
    const pointsNum = parseFloat(item.points);
    const isPositive = pointsNum > 0;
    const isNegative = pointsNum < 0;

    return (
      <View style={styles.pointCard}>
        <View style={styles.pointHeader}>
          <Text style={styles.guardName}>{item.guard_name}</Text>
          <View style={[
            styles.pointsBadge,
            isPositive && styles.pointsBadgePositive,
            isNegative && styles.pointsBadgeNegative,
          ]}>
            <Text style={[
              styles.pointsText,
              isPositive && styles.pointsTextPositive,
              isNegative && styles.pointsTextNegative,
            ]}>
              {isPositive ? '+' : ''}{item.points}
            </Text>
          </View>
        </View>
        <Text style={styles.explanation}>{item.explanation}</Text>
        <View style={styles.pointFooter}>
          <Text style={styles.dateText}>{formatDate(item.date_awarded)}</Text>
        </View>
      </View>
    );
  };

  const renderRulesCard = () => {
    if (!settings) return null;

    return (
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>Trenutna pravila - pozitivni i negativni bodovi</Text>
        
        <View style={styles.rulesSection}>
          <Text style={styles.rulesSectionTitle}>Pozitivni bodovi</Text>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Završena pozicija:</Text>
            <Text style={styles.ruleValue}>+{settings.award_for_position_completion}</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Završena nedjeljna pozicija:</Text>
            <Text style={styles.ruleValue}>+{settings.award_for_sunday_position_completion}</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Uskakanje na otkazanu poziciju:</Text>
            <Text style={styles.ruleValue}>+{settings.award_for_jumping_in_on_cancelled_position}</Text>
          </View>
        </View>

        <View style={styles.rulesSection}>
          <Text style={styles.rulesSectionTitle}>Negativni bodovi</Text>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Zakašnjenje uz obavijest:</Text>
            <Text style={styles.ruleValue}>{settings.penalty_for_being_late_with_notification}</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Zakašnjenje bez obavijesti:</Text>
            <Text style={styles.ruleValue}>{settings.penalty_for_being_late_without_notification}</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Otkazivanje na dan pozicije:</Text>
            <Text style={styles.ruleValue}>{settings.penalty_for_position_cancellation_on_the_position_day}</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Otkazivanje prije dana pozicije:</Text>
            <Text style={styles.ruleValue}>{settings.penalty_for_position_cancellation_before_the_position_day}</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>Upis manje od minimalnog broja pozicija:</Text>
            <Text style={styles.ruleValue}>{settings.penalty_for_assigning_less_then_minimal_positions}</Text>
          </View>
        </View>

        <View style={styles.pointsLifeSection}>
          <Text style={styles.pointsLifeText}>
            Vrijeme života bodova: <Text style={styles.pointsLifeValue}>{settings.points_life_weeks}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const renderPrioritySection = () => {
    return (
      <View style={styles.prioritySection}>
        {guardUser && (
          <Text style={styles.priorityText}>
            Vaš prioritetni broj je trenutno: <Text style={styles.priorityNumber}>{guardUser.guard_profile?.priority_number || '0'}</Text>
          </Text>
        )}
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowExplanationModal(true)}
        >
          <Text style={styles.headerButtonText}>Objašnjenje računanja prioritetnog broja</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Admin Header Controls */}
      {isAdmin && (
        <View style={styles.adminHeaderRow}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.headerButtonText}>Dodijeli proizvoljne bodove</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton]}
            onPress={() => setShowLateModal(true)}
          >
            <Text style={styles.headerButtonText}>Zakašnjenje bez obavijesti</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={openFiltersModal}
          >
            <Text style={styles.filterButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rules Card - visible to all */}
      {renderRulesCard()}

      {/* Priority Section - visible to all */}
      {renderPrioritySection()}

      {/* Section Title */}
      <Text style={styles.sectionTitle}>Ostvareni bodovi</Text>
    </View>
  );

  if (loading && points.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0A3323" />
        <Text style={styles.loadingText}>Učitavanje...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={points}
        renderItem={renderPointItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nema bodova za prikaz.</Text>
          </View>
        }
        ListFooterComponent={
          (next || prev) ? (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, !prev && styles.paginationButtonDisabled]}
                onPress={() => prev && fetchPoints(page - 1)}
                disabled={!prev}
              >
                <Text style={[styles.paginationButtonText, !prev && styles.paginationButtonTextDisabled]}>
                  Prethodna
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.pageInfo}>Stranica {page}</Text>
              
              <TouchableOpacity
                style={[styles.paginationButton, !next && styles.paginationButtonDisabled]}
                onPress={() => next && fetchPoints(page + 1)}
                disabled={!next}
              >
                <Text style={[styles.paginationButtonText, !next && styles.paginationButtonTextDisabled]}>
                  Sljedeća
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />

      {/* Filter/Sort Modal */}
      <Modal visible={showFiltersModal} transparent animationType="slide" statusBarTranslucent onRequestClose={cancelFilters}>
        <View style={styles.modalOverlay}>
          <View style={styles.filtersModalContent}>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* FILTERI */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Filteri</Text>
                
                <Text style={styles.label}>Čuvar</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowGuardDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempGuardFilter === null 
                        ? 'Svi čuvari' 
                        : getGuardDisplayName(tempGuardFilter)}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SORTIRANJE */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sortiranje</Text>
                
                <Text style={styles.label}>Redoslijed po datumu</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowSortDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortOrder === 'asc' ? '↑ Uzlazno (najstarije prvo)' : '↓ Silazno (najnovije prvo)'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            
            {/* BUTTONS */}
            <View style={styles.filtersModalFooter}>
              <TouchableOpacity
                style={styles.filterCancelButton}
                onPress={cancelFilters}
              >
                <Text style={styles.filterCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={applyFilters}
              >
                <Text style={styles.filterApplyButtonText}>Primijeni</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Guard Filter Dropdown Modal */}
      <Modal visible={showGuardDropdown} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowGuardDropdown(false)}>
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowGuardDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              <TouchableOpacity
                style={[styles.dropdownItem, tempGuardFilter === null && styles.dropdownItemSelected]}
                onPress={() => { setTempGuardFilter(null); setShowGuardDropdown(false); }}
              >
                <Text style={styles.dropdownItemText}>Svi čuvari</Text>
              </TouchableOpacity>
              {guards.map((guard) => (
                <TouchableOpacity
                  key={guard.id}
                  style={[styles.dropdownItem, tempGuardFilter === guard.id && styles.dropdownItemSelected]}
                  onPress={() => { setTempGuardFilter(guard.id); setShowGuardDropdown(false); }}
                >
                  <Text style={styles.dropdownItemText}>{guard.full_name || guard.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Dropdown Modal */}
      <Modal visible={showSortDropdown} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowSortDropdown(false)}>
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'desc' && styles.dropdownItemSelected]}
              onPress={() => { setTempSortOrder('desc'); setShowSortDropdown(false); }}
            >
              <Text style={styles.dropdownItemText}>↓ Silazno (najnovije prvo)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'asc' && styles.dropdownItemSelected]}
              onPress={() => { setTempSortOrder('asc'); setShowSortDropdown(false); }}
            >
              <Text style={styles.dropdownItemText}>↑ Uzlazno (najstarije prvo)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Point Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodijeli proizvoljne bodove</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Čuvar *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowGuardPickerModal(true)}
              >
                <Text style={styles.pickerText}>
                  {getGuardDisplayName(selectedGuardId)}
                </Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Bodovi * (od -10 do 10)</Text>
              <TextInput
                style={styles.input}
                value={pointsValue}
                onChangeText={setPointsValue}
                keyboardType="numeric"
                placeholder="npr. 2 ili -3"
                placeholderTextColor="#A6C27A"
              />

              <Text style={styles.label}>Objašnjenje *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={explanation}
                onChangeText={setExplanation}
                multiline
                numberOfLines={3}
                placeholder="Razlog za dodjelu bodova..."
                placeholderTextColor="#A6C27A"
                autoComplete="off"
                autoCorrect={false}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowCreateModal(false); resetCreateForm(); }}
              >
                <Text style={styles.cancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={handleCreatePoint}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#A6C27A" />
                ) : (
                  <Text style={styles.submitButtonText}>Dodijeli</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Guard Picker Modal for Create */}
      <Modal visible={showGuardPickerModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowGuardPickerModal(false)}>
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowGuardPickerModal(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              {guards.map((guard) => (
                <TouchableOpacity
                  key={guard.id}
                  style={[styles.dropdownItem, selectedGuardId === guard.id && styles.dropdownItemSelected]}
                  onPress={() => { setSelectedGuardId(guard.id); setShowGuardPickerModal(false); }}
                >
                  <Text style={styles.dropdownItemText}>{guard.full_name || guard.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Late Without Notification Modal */}
      <Modal visible={showLateModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowLateModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Zakašnjenje bez obavijesti</Text>
            
            <Text style={styles.lateDescription}>
              Dodijelite kaznu čuvaru za zakašnjenje bez prethodne obavijesti.
              {settings && (
                <Text style={styles.penaltyInfo}>
                  {'\n\n'}Kazna: <Text style={styles.penaltyValue}>{settings.penalty_for_being_late_without_notification} bodova</Text>
                </Text>
              )}
            </Text>

            <Text style={styles.label}>Odaberi čuvara *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowLateGuardPicker(true)}
            >
              <Text style={styles.pickerText}>
                {getGuardDisplayName(lateGuardId)}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowLateModal(false); setLateGuardId(null); }}
              >
                <Text style={styles.cancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, styles.lateSubmitButton, lateSubmitting && styles.buttonDisabled]}
                onPress={handleLateWithoutNotification}
                disabled={lateSubmitting}
              >
                {lateSubmitting ? (
                  <ActivityIndicator size="small" color="#A6C27A" />
                ) : (
                  <Text style={styles.submitButtonText}>Dodijeli kaznu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Late Guard Picker Modal */}
      <Modal visible={showLateGuardPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowLateGuardPicker(false)}>
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowLateGuardPicker(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              {guards.map((guard) => (
                <TouchableOpacity
                  key={guard.id}
                  style={[styles.dropdownItem, lateGuardId === guard.id && styles.dropdownItemSelected]}
                  onPress={() => { setLateGuardId(guard.id); setShowLateGuardPicker(false); }}
                >
                  <Text style={styles.dropdownItemText}>{guard.full_name || guard.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Explanation Modal */}
      <Modal visible={showExplanationModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowExplanationModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.explanationModalContent}>
            <Text style={styles.modalTitle}>Objašnjenje prioritetnog broja</Text>
            <ScrollView style={styles.explanationScroll}>
              {/* Uvod */}
              <Text style={styles.explanationSectionTitle}>Prioritetni broj</Text>
              <Text style={styles.explanationText}>
                Prioritetni broj računa se svaki ponedjeljak s obzirom na bodove ostvarene u posljednjih X tjedana.
              </Text>
              <Text style={styles.explanationText}>
                X je broj poznat kao "vrijeme života bodova" i označava onaj broj tjedana koliko vaši ostvareni bodovi vrijede prije nego se prestanu uzimati u obzir. Taj broj mogu mijenjati administratori.
              </Text>
              <Text style={styles.explanationText}>
                Bodovi koje ostvarujete u trenutnom tjednu u prioritetni broj uračunat će se tek prvi sljedeći ponedjeljak i vrijediti od idućeg tjedna pa narednih x tjedana.
              </Text>
              <Text style={styles.explanationText}>
                Osnovna ideja je da se bodovi postepeno obnavljaju, tako da stariji tjedni iza nas pridonose manje, a noviji više. Tjedan koji je iza nas najviše pridonosi ukupnom broju, onaj iza njega nešto manje, itd. sve do X + 1 tjedana unazad, kada bodovi više ne vrijede.
              </Text>

              {/* Formula */}
              <Text style={styles.explanationSectionTitle}>Računanje</Text>
              <Text style={styles.explanationText}>
                Efekt posljednjeg tjedna je jednostavno zbroj svih bodova koje ste ostvarili u prošlom tjednu.
              </Text>
              <Text style={styles.explanationText}>
                Efekt ranijih tjedana dijeli se s varijablinim faktorom kako bi postepeno gubili značaj:
              </Text>
              <Text style={styles.explanationFormula}>
                faktor = 1 + (0.2 × i)
              </Text>
              <Text style={styles.explanationText}>
                gdje je i = broj tjedana unazad od prošlog (pretprošli = 1, pretpretprošli = 2, itd.)
              </Text>

              {/* Primjer */}
              <Text style={styles.explanationSectionTitle}>Primjer</Text>
              <Text style={styles.explanationText}>
                Ako je vrijeme života bodova 3, odnosno 3 tjedna, a u svakom tjednu ste ostvarili 10 bodova:
              </Text>
              <View style={styles.explanationExample}>
                <Text style={styles.explanationExampleText}>• Prošli tjedan: 10 bodova</Text>
                <Text style={styles.explanationExampleText}>• Pretprošli tjedan: 10 ÷ 1.2 = 8.33 bodova</Text>
                <Text style={styles.explanationExampleText}>• Pretpretprošli tjedan: 10 ÷ 1.4 = 7.14 bodova</Text>
                <Text style={styles.explanationExampleResult}>Ukupno = 25.47 = vaš prioritetni broj</Text>
              </View>

              {/* Novi čuvari */}
              <Text style={styles.explanationSectionTitle}>Novi čuvari</Text>
              <Text style={styles.explanationText}>
                Novi čuvari ulaze u sustav s prosječnim prioritetnim brojem svih ostalih čuvara. Svakim tjednom taj broj postaje sve više "njihov", a nakon X tjedana imaju potpuno svoj prioritetni broj.
              </Text>

              {/* Automatsko upisivanje */}
              <Text style={styles.explanationSectionTitle}>Automatsko upisivanje</Text>
              <Text style={styles.explanationText}>
                Tijekom automatskog upisivanja vaš korisnički račun konkurira za svaku poziciju koju ste u mogućnosti raditi. Budući čuvar upisan na tu poziciju određuje se uz pomoć mađarskog algoritma.
              </Text>
              <Text style={styles.explanationText}>
                Značaj pojedine prijave na poziciju:
              </Text>
              <View style={styles.explanationExample}>
                <Text style={styles.explanationExampleText}>• 60% - vaš prioritetni broj</Text>
                <Text style={styles.explanationExampleText}>• 20% - preferencija za dan</Text>
                <Text style={styles.explanationExampleText}>• 20% - preferencija za izložbu</Text>
              </View>

              {/* Preferencije */}
              <Text style={styles.explanationSectionTitle}>Preferencije</Text>
              <Text style={styles.explanationText}>
                Ako postavite preferencije za dane ili izložbe, žrtvujete svoje manje preferirane opcije da povećate vjerojatnost upisa na one koje više želite.
              </Text>
              <Text style={styles.explanationText}>
                To znači da ćete u hipotetskoj situaciji, u odnosu na kolegu/icu koji imaju isti prioritetni broj kao vi i nepostavljene preferencije biti u prednosti na dane i izložbe koje vam više odgovaraju ali će oni biti u prednosti na pozicijama koje su vama označene kao manje prioritetne. 
              </Text>

              {/* Zaključak */}
              <Text style={styles.explanationSectionTitle}>Oprez i odgovornost</Text>
              <Text style={styles.explanationText}>
                Sustav bodovanja osmišljen je kao pravednija alternativa sustavu "tko prvi njegova/njena pozicija" koji također ima svoje pozitivne strane i uvijek je opcija kojoj se možemo vratiti. Jedini smisao bodovanja jest dati prednost upisa čuvarima koji su u posljednjih nekoliko tjedana: više radili, manje kasnili, više uskakali u neplanirane smjene, itd.
              </Text>
              <Text style={styles.explanationText}>
                Sustav je eksperimentalan i smatram da bismo svi trebali biti osjetljivi na eventualne negativne posljedice koje bi mogao imati na dinamiku rada i odnose među čuvarima. Nije zamišljen da potiče kompetitivnost među kolegama i bilo kakve naznake zakinutosti nužno je što prije prijaviti nadređenima.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowExplanationModal(false)}
            >
              <Text style={styles.closeButtonText}>Zatvori</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
  },
  loadingText: {
    marginTop: 10,
    color: '#0A3323',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  adminHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  headerButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    minWidth: 140,
  },
  lateButton: {
    backgroundColor: '#D3968C',
  },
  headerButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  filterButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterButtonText: {
    fontSize: 18,
  },
  rulesCard: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 16,
  },
  rulesSection: {
    marginBottom: 12,
  },
  rulesSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#105666',
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  ruleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A3323',
    flex: 1,
  },
  ruleValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#105666',
  },
  pointsLifeSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#0A3323',
  },
  pointsLifeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A3323',
  },
  pointsLifeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#105666',
  },
  prioritySection: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priorityText: {
    fontSize: 15,
    color: '#0A3323',
    marginBottom: 12,
  },
  priorityNumber: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#105666',
  },
  explanationButton: {
    backgroundColor: '#A6C27A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  explanationButtonText: {
    color: '#105666',
    fontWeight: '500',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3323',
    marginTop: 8,
    marginBottom: 8,
  },
  pointCard: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  guardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A3323',
    flex: 1,
  },
  pointsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#A6C27A',
  },
  pointsBadgePositive: {
    backgroundColor: '#A6C27A',
  },
  pointsBadgeNegative: {
    backgroundColor: '#D3968C',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#105666',
  },
  pointsTextPositive: {
    color: '#105666',
  },
  pointsTextNegative: {
    color: '#105666',
  },
  explanation: {
    fontSize: 14,
    color: '#0A3323',
    marginBottom: 8,
  },
  pointFooter: {
    borderTopWidth: 1,
    borderTopColor: '#0A3323',
    paddingTop: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#105666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#0A3323',
    fontStyle: 'italic',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F7F4D5',
    borderTopWidth: 1,
    borderTopColor: '#A6C27A',
  },
  paginationButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#A6C27A',
  },
  paginationButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationButtonTextDisabled: {
    color: '#105666',
  },
  pageInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3323',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  filtersModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  explanationModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    marginBottom: 8,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 14,
  },
  pickerText: {
    fontSize: 15,
    color: '#0A3323',
    fontWeight: '500',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#D3968C',
  },
  input: {
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0A3323',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  filtersModalFooter: {
    flexDirection: 'row',
    marginTop: 15,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#105666',
    gap: 10,
  },
  filterCancelButton: {
    flex: 1,
    backgroundColor: '#D3968C',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterCancelButtonText: {
    color: '#0A3323',
    fontWeight: '700',
    fontSize: 17,
  },
  filterApplyButton: {
    flex: 1,
    backgroundColor: '#0A3323',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterApplyButtonText: {
    color: '#A6C27A',
    fontWeight: '700',
    fontSize: 17,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#A6C27A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#105666',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#D3968C',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  lateSubmitButton: {
    backgroundColor: '#D3968C',
  },
  submitButtonText: {
    color: '#0A3323',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  applyButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 16,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dropdownContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    width: '100%',
    maxHeight: 300,
  },
  dropdownScroll: {
    maxHeight: 280,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  dropdownItemSelected: {
    backgroundColor: '#A6C27A',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#0A3323',
  },
  lateDescription: {
    fontSize: 14,
    color: '#0A3323',
    marginBottom: 16,
    lineHeight: 20,
  },
  penaltyInfo: {
    color: '#0A3323',
  },
  penaltyValue: {
    fontWeight: 'bold',
    color: '#D3968C',
  },
  explanationScroll: {
    maxHeight: 400,
  },
  explanationSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#105666',
    marginTop: 16,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 15,
    color: '#105666',
    lineHeight: 21,
    marginBottom: 8,
  },
  explanationNote: {
    fontSize: 13,
    color: '#A6C27A',
    fontStyle: 'italic',
    backgroundColor: '#105666',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    lineHeight: 19,
  },
  explanationFormula: {
    fontSize: 15,
    fontWeight: '600',
    color: '#105666',
    textAlign: 'center',
    backgroundColor: '#F7F4D5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  explanationExample: {
    backgroundColor: '#F7F4D5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#105666',
  },
  explanationExampleText: {
    fontSize: 14,
    color: '#105666',
    lineHeight: 22,
  },
  explanationExampleResult: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#105666',
    marginTop: 8,
  },
  explanationWarning: {
    fontSize: 13,
    color: '#F7F4D5',
    backgroundColor: '#D3968C',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    lineHeight: 19,
  },
  closeButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 16,
  },
});
