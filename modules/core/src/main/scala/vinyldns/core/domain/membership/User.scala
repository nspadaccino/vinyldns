/*
 * Copyright 2018 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package vinyldns.core.domain.membership

import java.util.UUID

import org.apache.commons.lang3.RandomStringUtils
import java.time.Instant
import vinyldns.core.crypto.CryptoAlgebra
import vinyldns.core.domain.membership.LockStatus.LockStatus
import java.time.temporal.ChronoUnit

object LockStatus extends Enumeration {
  type LockStatus = Value
  val Locked, Unlocked = Value
}

final case class User(
    userName: String,
    accessKey: String,
    secretKey: String,
    firstName: Option[String] = None,
    lastName: Option[String] = None,
    email: Option[String] = None,
    created: Instant = Instant.now.truncatedTo(ChronoUnit.MILLIS),
    id: String = UUID.randomUUID().toString,
    isSuper: Boolean = false,
    lockStatus: LockStatus = LockStatus.Unlocked,
    isSupport: Boolean = false,
    isTest: Boolean = false
) {

  def updateUserLockStatus(lockStatus: LockStatus): User =
    this.copy(lockStatus = lockStatus)

  def regenerateCredentials(): User =
    copy(accessKey = User.generateKey, secretKey = User.generateKey)

  def withEncryptedSecretKey(cryptoAlgebra: CryptoAlgebra): User =
    copy(secretKey = cryptoAlgebra.encrypt(secretKey))
}

object User {
  def generateKey: String = RandomStringUtils.randomAlphanumeric(20)
}
