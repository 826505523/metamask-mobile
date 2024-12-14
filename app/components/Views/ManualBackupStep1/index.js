import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Appearance,
} from 'react-native';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import FeatherIcons from 'react-native-vector-icons/Feather';
import { BlurView } from '@react-native-community/blur';
import { wordlist } from '@metamask/scure-bip39/dist/wordlists/english';
import Logger from '../../../util/Logger';
import { baseStyles } from '../../../styles/common';
import StyledButton from '../../UI/StyledButton';
import OnboardingProgress from '../../UI/OnboardingProgress';
import { strings } from '../../../../locales/i18n';
import ActionView from '../../UI/ActionView';
import Engine from '../../../core/Engine';
import { getOnboardingNavbarOptions } from '../../UI/Navbar';
import { ScreenshotDeterrent } from '../../UI/ScreenshotDeterrent';
import {
  MANUAL_BACKUP_STEPS,
  SEED_PHRASE,
  CONFIRM_PASSWORD,
  WRONG_PASSWORD_ERROR,
} from '../../../constants/onboarding';
import { useTheme } from '../../../util/theme';
import { uint8ArrayToMnemonic } from '../../../util/mnemonic';
import { createStyles } from './styles';

import { MetaMetricsEvents } from '../../../core/Analytics';
import { Authentication } from '../../../core';
import { ManualBackUpStepsSelectorsIDs } from '../../../../e2e/selectors/Onboarding/ManualBackUpSteps.selectors';
import trackOnboarding from '../../../util/metrics/TrackOnboarding/trackOnboarding';
import { MetricsEventBuilder } from '../../../core/Analytics/MetricsEventBuilder';

/**
 * View that's shown during the second step of
 * the backup seed phrase flow
 */
const ManualBackupStep1 = ({ route, navigation, appTheme }) => {
  const [seedPhraseHidden, setSeedPhraseHidden] = useState(true);

  const [password, setPassword] = useState(undefined);
  const [warningIncorrectPassword, setWarningIncorrectPassword] =
    useState(undefined);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState(SEED_PHRASE);
  const [words, setWords] = useState([]);

  const { colors, themeAppearance } = useTheme();
  const styles = createStyles(colors);

  const currentStep = 1;
  const steps = MANUAL_BACKUP_STEPS;

  const updateNavBar = useCallback(() => {
    navigation.setOptions(getOnboardingNavbarOptions(route, {}, colors));
  }, [colors, navigation, route]);

  const tryExportSeedPhrase = async (password) => {
    const { KeyringController } = Engine.context;
    const uint8ArrayMnemonic = await KeyringController.exportSeedPhrase(
      password,
    );
    return uint8ArrayToMnemonic(uint8ArrayMnemonic, wordlist).split(' ');
  };

  useEffect(() => {
    const getSeedphrase = async () => {
      if (!words.length) {
        try {
          const credentials = await Authentication.getPassword();
          if (credentials) {
            setWords(await tryExportSeedPhrase(credentials.password));
          } else {
            setView(CONFIRM_PASSWORD);
          }
        } catch (e) {
          const srpRecoveryError = new Error(
            'Error trying to recover SRP from keyring-controller',
          );
          Logger.error(srpRecoveryError);
          setView(CONFIRM_PASSWORD);
        }
      }
    };

    getSeedphrase();
    setWords(route.params?.words ?? []);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateNavBar();
  }, [updateNavBar]);

  const onPasswordChange = (password) => {
    setPassword(password);
  };

  const goNext = () => {
    navigation.navigate('ManualBackupStep2', {
      words,
      steps,
    });
  };

  const revealSeedPhrase = () => {
    setSeedPhraseHidden(false);
    trackOnboarding(
      MetricsEventBuilder.createEventBuilder(
        MetaMetricsEvents.WALLET_SECURITY_PHRASE_REVEALED,
      ).build(),
    );
  };

  const tryUnlockWithPassword = async (password) => {
    setReady(false);
    try {
      const seedPhrase = await tryExportSeedPhrase(password);
      setWords(seedPhrase);
      setView(SEED_PHRASE);
      setReady(true);
    } catch (e) {
      let msg = strings('reveal_credential.warning_incorrect_password');
      if (e.toString().toLowerCase() !== WRONG_PASSWORD_ERROR.toLowerCase()) {
        msg = strings('reveal_credential.unknown_error');
      }
      setWarningIncorrectPassword(msg);
      setReady(true);
    }
  };

  const tryUnlock = () => {
    tryUnlockWithPassword(password);
  };

  const getBlurType = () => {
    let blurType = 'light';
    switch (appTheme) {
      case 'light':
        blurType = 'light';
        break;
      case 'dark':
        blurType = 'dark';
        break;
      case 'os':
        blurType = Appearance.getColorScheme();
        break;
      default:
        blurType = 'light';
    }
    return blurType;
  };

  const renderSeedPhraseConcealer = () => {
    const blurType = getBlurType();

    return (
      <View style={styles.seedPhraseConcealerContainer}>
        <BlurView blurType={blurType} blurAmount={5} style={styles.blurView} />
        <View style={styles.seedPhraseConcealer}>
          <FeatherIcons name="eye-off" size={24} style={styles.icon} />
          <Text style={styles.reveal}>
            {strings('manual_backup_step_1.reveal')}
          </Text>
          <Text style={styles.watching}>
            {strings('manual_backup_step_1.watching')}
          </Text>
          <View style={styles.viewButtonWrapper}>
            <StyledButton
              type={'onOverlay'}
              onPress={revealSeedPhrase}
              testID={ManualBackUpStepsSelectorsIDs.VIEW_BUTTON}
              containerStyle={styles.viewButtonContainer}
            >
              {strings('manual_backup_step_1.view')}
            </StyledButton>
          </View>
        </View>
      </View>
    );
  };

  const renderConfirmPassword = () => (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={'padding'}
    >
      <KeyboardAwareScrollView style={baseStyles.flexGrow} enableOnAndroid>
        <View style={styles.confirmPasswordWrapper}>
          <View style={[styles.content, styles.passwordRequiredContent]}>
            <Text style={styles.title}>
              {strings('manual_backup_step_1.confirm_password')}
            </Text>
            <View style={styles.text}>
              <Text style={styles.label}>
                {strings('manual_backup_step_1.before_continiuing')}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={'Password'}
              placeholderTextColor={colors.text.muted}
              onChangeText={onPasswordChange}
              secureTextEntry
              onSubmitEditing={tryUnlock}
              testID={ManualBackUpStepsSelectorsIDs.CONFIRM_PASSWORD_INPUT}
              keyboardAppearance={themeAppearance}
              autoCapitalize="none"
            />
            {warningIncorrectPassword && (
              <Text style={styles.warningMessageText}>
                {warningIncorrectPassword}
              </Text>
            )}
          </View>
          <View style={styles.buttonWrapper}>
            <StyledButton
              containerStyle={styles.button}
              type={'confirm'}
              onPress={tryUnlock}
              testID={ManualBackUpStepsSelectorsIDs.SUBMIT_BUTTON}
            >
              {strings('manual_backup_step_1.confirm')}
            </StyledButton>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );

  const renderSeedphraseView = () => {
    const wordLength = words.length;
    const half = wordLength / 2 || 6;

    return (
      <ActionView
        confirmTestID={ManualBackUpStepsSelectorsIDs.CONTINUE_BUTTON}
        confirmText={strings('manual_backup_step_1.continue')}
        onConfirmPress={goNext}
        confirmDisabled={seedPhraseHidden}
        showCancelButton={false}
        confirmButtonMode={'confirm'}
      >
        <View
          style={styles.wrapper}
          testID={ManualBackUpStepsSelectorsIDs.STEP_1_CONTAINER}
        >
          <Text style={styles.action}>
            {strings('manual_backup_step_1.action')}
          </Text>
          <View style={styles.infoWrapper}>
            <Text style={styles.info}>
              {strings('manual_backup_step_1.info')}
            </Text>
          </View>
          <View style={styles.seedPhraseWrapper}>
            {seedPhraseHidden ? (
              renderSeedPhraseConcealer()
            ) : (
              <React.Fragment>
                <View style={styles.wordColumn}>
                  {words.slice(0, half).map((word, i) => (
                    <View key={`word_${i}`} style={styles.wordWrapper}>
                      <Text style={styles.word}>{`${i + 1}. ${word}`}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.wordColumn}>
                  {words.slice(-half).map((word, i) => (
                    <View key={`word_${i}`} style={styles.wordWrapper}>
                      <Text style={styles.word}>{`${
                        i + (half + 1)
                      }. ${word}`}</Text>
                    </View>
                  ))}
                </View>
                <ScreenshotDeterrent enabled isSRP />
              </React.Fragment>
            )}
          </View>
        </View>
      </ActionView>
    );
  };

  return ready ? (
    <SafeAreaView style={styles.mainWrapper}>
      <View style={styles.onBoardingWrapper}>
        <OnboardingProgress currentStep={currentStep} steps={steps} />
      </View>
      {view === SEED_PHRASE ? renderSeedphraseView() : renderConfirmPassword()}
    </SafeAreaView>
  ) : (
    <View style={styles.loader}>
      <ActivityIndicator size="small" />
    </View>
  );
};

ManualBackupStep1.propTypes = {
  /**
  /* navigation object required to push and pop other views
  */
  navigation: PropTypes.object,
  /**
   * Object that represents the current route info like params passed to it
   */
  route: PropTypes.object,
  /**
   * Theme that app is set to
   */
  appTheme: PropTypes.string,
};

const mapStateToProps = (state) => ({
  appTheme: state.user.appTheme,
});

export default connect(mapStateToProps)(ManualBackupStep1);
