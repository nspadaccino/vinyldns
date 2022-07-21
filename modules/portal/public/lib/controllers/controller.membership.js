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

angular.module('controller.membership', []).controller('MembershipController', function ($scope, $log, $location, $timeout, pagingService,
                                                                                         groupsService, profileService, utilityService) {

    $scope.membership = { members: [], group: {} };
    $scope.membershipLoaded = false;
    $scope.alerts = [];
    $scope.isGroupAdmin = false;
    $scope.groupChanges = {};
    $scope.currentGroup = {};
    $scope.isCreatedOrNew = false;

    $scope.groupModalState = {
        VIEW_DETAILS: 1
    };
    $scope.disabledStates = [$scope.groupModalState.VIEW_DETAILS];

    // read-only data for setting various classes/attributes in group modal
    $scope.groupModalParams = {
        readOnly: {
            class: "",
            readOnly: true
        }
    };

    // paging status for group changes
    var changePaging = pagingService.getNewPagingParams(100);

    function handleError(error, type) {
        var alert = utilityService.failure(error, type);
        $scope.alerts.push(alert);
    }

    $scope.getGroupMemberList = function(groupId) {
        function success(response) {
            $log.log('groupsService::getGroupMemberList-success');
            return response.data;
        }
        return groupsService
            .getGroupMemberList(groupId)
            .then(success)
            .catch(function (error) {
                handleError(error, 'groupsService::getGroupMemberList-failure');
            });
    };

    $scope.getGroup = function(groupId) {
        function success(response) {
            $log.log('groupsService::getGroup-success');
            return response.data;
        }
        return groupsService
            .getGroup(groupId)
            .then(success)
            .catch(function (error) {
                handleError(error, 'groupsService::getGroup-failure');
            });
    };

    function determineAdmin() {
        profileService.getAuthenticatedUserData().then(
            function (results) {
                var admins = $scope.membership.group.admins.map(function (id_json) {
                     return id_json['id']});
                var superUser = angular.isUndefined(results.data.isSuper) ? false : results.data.isSuper;
                $scope.isGroupAdmin = admins.indexOf(results.data.id) > -1 || superUser;
                });
    }

    $scope.resetNewMemberData = function() {
        $scope.newMemberData = {
            isAdmin : false,
            login : ""
        };
    };

    $scope.addMember = function() {
        $log.log('addGroupMember::newMemberData', $scope.newMemberData);
        function lookupAccountSuccess(response) {
            if (response.data) {
                $scope.membership.group.members.push({ id: response.data.id });

                if ($scope.newMemberData.isAdmin) {
                    $scope.membership.group.admins.push({ id: response.data.id });
                }

                function updateGroupSuccess(results) {
                    var alert = utilityService.success("Added " + $scope.newMemberData.login, response,
                        'addMember::getUserDataByUsername successful');
                    $scope.alerts.push(alert);
                    $scope.refresh();
                    return results;
                }
                return groupsService
                    .updateGroup($scope.membership.group.id, $scope.membership.group)
                    .then(updateGroupSuccess)
                    .catch(function (error) {
                        $scope.refresh();
                        handleError(error, 'groupsService::updateGroup-failure-catch');
                    });
            }
        }

        return profileService.getUserDataByUsername($scope.newMemberData.login)
            .then(lookupAccountSuccess)
            .catch(function (error) {
                handleError(error, 'profileService::getUserDataByUsername-failure-catch');
            });
    };

    $scope.removeMember = function(memberId) {

        var keepUser = function (user) {
            return user.id != memberId;
        };

        $log.log('removing group member ' + memberId + ' from group ' + $scope.membership.group.id);

        $scope.membership.group.admins = $scope.membership.group.admins.filter(keepUser);
        $scope.membership.group.members = $scope.membership.group.members.filter(keepUser);

        function success(results) {
            var alert = utilityService.success("Successfully Removed Member", results,
                "groupsService::updateGroup-success");
            $scope.alerts.push(alert);
            $scope.refresh();
            return results.data;
        }
        //update the group
        return groupsService
            .updateGroup($scope.membership.group.id, $scope.membership.group)
            .then(success)
            .catch(function (error) {
                $scope.refresh();
                handleError(error, 'groupsService::updateGroup-failure');
            });
    };

    $scope.toggleAdmin = function(member) {

        var keepUser = function (user) {
            return user.id != member.id;
        };

        $log.log('toggleAdmin::toggled for member', member);

        if(member.isAdmin) {
            $log.log('toggleAdmin::toggled making an admin');
            $scope.membership.group.admins.push({ id: member.id });
        } else {
            $log.log('toggleAdmin::toggled removing as admin');
            $scope.membership.group.admins = $scope.membership.group.admins.filter(keepUser);
        }

        function success(results) {
            var alert = utilityService.success("Toggled Status of " + member.userName, results,
                "toggleAdmin::status toggled");
            $scope.alerts.push(alert);
            $scope.refresh();
            return results.data;
        }

        //update the group
        return groupsService
            .updateGroup($scope.membership.group.id, $scope.membership.group)
            .then(success)
            .catch(function (error) {
                $scope.refresh();
                handleError(error, 'groupsService::updateGroup-failure');
            });
    };


    $scope.getGroupInfo = function (id) {
        //store group membership
        function getGroupSuccess(result) {
            $log.log('refresh::getGroupSuccess-success', result);
            //update groups
            $scope.membership.group = result;

            determineAdmin();

            function getGroupMemberListSuccess(result) {
                $log.log('refresh::getGroupMemberList-success', result);
                //update groups
                $scope.membership.members = result.members;
                $scope.membershipLoaded = true;
                return result;
            }

            return $scope.getGroupMemberList(id)
                .then(getGroupMemberListSuccess)
                .catch(function (error) {
                    handleError(error, 'refresh::getGroupMemberList-failure');
                });
        }

        return $scope.getGroup(id)
            .then(getGroupSuccess)
            .catch(function (error) {
                handleError(error, 'refresh::getGroup-failure');
            });
    };

    $scope.refresh = function () {
        var id = $location.absUrl().toString();
        id = id.substring(id.lastIndexOf('/') + 1);
        $log.log('loading group with id ', id);

        $scope.isGroupAdmin = false;

        $scope.resetNewMemberData();
        $scope.getGroupInfo(id);
        $scope.refreshGroupChanges(id);
    };

    $scope.refreshGroupChanges = function(id) {
        if(!id){
            var id = $location.absUrl().toString();
            id = id.substring(id.lastIndexOf('/') + 1);
            id = id.substring(0, id.indexOf('#'))
        }
        $log.log('refreshGroupChanges, loading group with id ', id);
        changePaging = pagingService.resetPaging(changePaging);
        function success(response) {
            $log.log('groupsService::getGroupChanges-success');
            changePaging.next = response.data.nextId;
            updateChangeDisplay(response.data.changes)
        }
        return groupsService
            .getGroupChanges(id, changePaging.maxItems, undefined)
            .then(success)
            .catch(function (error){
                handleError(error, 'groupsService::getGroupChanges-failure');
            });
    };

    function updateChangeDisplay(changes) {
        var newChanges = [];
        angular.forEach(changes, function(change) {
            newChanges.push(change);
        });
        $scope.groupChanges = newChanges;
    }

    /**
     * Group change paging
     */
    $scope.getChangePageTitle = function() {
        return pagingService.getPanelTitle(changePaging);
    };

    $scope.changePrevPageEnabled = function() {
        return pagingService.prevPageEnabled(changePaging);
    };

    $scope.changeNextPageEnabled = function() {
        return pagingService.nextPageEnabled(changePaging);
    };

    $scope.changePrevPage = function() {
        var startFrom = pagingService.getPrevStartFrom(changePaging);
        var id = $location.absUrl().toString();
        id = id.substring(id.lastIndexOf('/') + 1);
        id = id.substring(0, id.indexOf('#'))
        $log.log('changePrevPage, loading group with id ', id);
        return groupsService
            .getGroupChanges(id, changePaging.maxItems, startFrom)
            .then(function(response) {
                changePaging = pagingService.prevPageUpdate(response.data.nextId, changePaging);
                updateChangeDisplay(response.data.changes);
            })
            .catch(function (error) {
                handleError(error, 'groupsService::changePrevPage-failure');
            });
    };

    $scope.changeNextPage = function() {
        var id = $location.absUrl().toString();
        id = id.substring(id.lastIndexOf('/') + 1);
        id = id.substring(0, id.indexOf('#'))
        $log.log('changeNextPage, loading group with id ', id);
        return groupsService
            .getGroupChanges(id, changePaging.maxItems, changePaging.next)
            .then(function(response) {
                var changes = response.data.changes;
                changePaging = pagingService.nextPageUpdate(changes, response.data.nextId, changePaging);

                if(changes.length > 0 ){
                    updateChangeDisplay(changes);
                }
            })
            .catch(function (error) {
                handleError(error, 'groupsService::changeNextPage-failure');
            });
    };

    function determineGroupDifference(newGroup, oldGroup) {
        var newGroupData = angular.copy(newGroup);
        var changeMessage = "";
        if(oldGroup.name !== newGroup.name){
            changeMessage += "Group name changed to '" + newGroup.name + "'.";
        }
        if(oldGroup.email !== newGroup.email){
            changeMessage += "Group email changed to '" + newGroup.email + "'.";
        }
        if(oldGroup.description !== newGroup.description){
            changeMessage += "Group description changed to '" + newGroup.description + "'.";
        }
        oldGroup.adminIds = [];
        angular.forEach(oldGroup.admins, function(admin) {
            oldGroup.adminIds.push(admin.id);
        });
        newGroupData.adminIds = [];
        angular.forEach(newGroup.admins, function(admin) {
            newGroupData.adminIds.push(admin.id);
        });
        var adminAddDifference = newGroupData.adminIds.filter(x => !oldGroup.adminIds.includes(x));
        if(adminAddDifference.length !== 0){
            changeMessage += "Group admin/s with userId/s (" + adminAddDifference + ") added.";
        }
        var adminRemoveDifference = oldGroup.adminIds.filter(x => !newGroupData.adminIds.includes(x));
        if(adminRemoveDifference.length !== 0){
            changeMessage += "Group admin/s with userId/s (" + adminRemoveDifference + ") removed.";
        }
        oldGroup.memberIds = [];
        angular.forEach(oldGroup.members, function(member) {
            oldGroup.memberIds.push(member.id);
        });
        newGroupData.memberIds = [];
        angular.forEach(newGroup.members, function(member) {
            newGroupData.memberIds.push(member.id);
        });
        var memberAddDifference = newGroupData.memberIds.filter(x => !oldGroup.memberIds.includes(x));
        if(memberAddDifference.length !== 0){
            changeMessage += "Group member/s with userId/s (" + memberAddDifference + ") added.";
        }
        var memberRemoveDifference = oldGroup.memberIds.filter(x => !newGroupData.memberIds.includes(x));
        if(memberRemoveDifference.length !== 0){
            changeMessage += "Group member/s with userId/s (" + memberRemoveDifference + ") removed.";
        }
        newGroupData.changeMessage = changeMessage;
        return newGroupData;
    }

    $scope.viewCreatedOrOldGroupInfo = function(group) {
        $scope.isCreatedOrNew = false;
        var newGroup = angular.copy(group);
        newGroup.adminIds = [];
        angular.forEach(group.admins, function(admin) {
            newGroup.adminIds.push(admin.id);
        });
        newGroup.memberIds = [];
        angular.forEach(group.members, function(member) {
            newGroup.memberIds.push(member.id);
        });
        $scope.currentGroup = newGroup;
        $scope.groupModal = {
            action: $scope.groupModalState.VIEW_DETAILS,
            title: "Created/Old Group Info",
            basics: $scope.groupModalParams.readOnly,
            details: $scope.groupModalParams.readOnly,
        };
        $("#group_modal").modal("show");
    };

    $scope.viewNewGroupInfo = function(newGroup, oldGroup) {
        $scope.isCreatedOrNew = true;
        $scope.currentGroup = determineGroupDifference(newGroup, oldGroup);
        $scope.groupModal = {
            action: $scope.groupModalState.VIEW_DETAILS,
            title: "New Group Info",
            basics: $scope.groupModalParams.readOnly,
            details: $scope.groupModalParams.readOnly,
        };
        $("#group_modal").modal("show");
    };

    $scope.closeGroupModal = function() {
        $scope.viewGroupForm.$setPristine();
    };

    $timeout($scope.refresh, 0);
});
